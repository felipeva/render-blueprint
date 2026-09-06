# Design D — Constructs and scopes (`new Resource(scope, name, props)` + `blueprint.synth()`)

## 1. Design thesis

Optimise for **composability at the cost of locality**. A blueprint is a tree of scopes; a resource
registers itself into the scope it is constructed against, and everything that repeats across a real
`render.yaml` (`repo`, `branch`, `region`, `plan`) cascades down that tree instead of being retyped.
Reuse is a **function that takes a scope late** (`defineComponent`), never a subclass. Names stay exactly
what the user typed — the tree contributes diagnostic paths only, never identity. Construction and
mutation are total and silent; every failure is collected and surfaced once, from `synth()`.

---

## 2. Interface signature

### 2.1 Scopes and placement

Two concepts cdk8s conflates into `Chart`, separated here: **placement** (where in the YAML a resource
lands) and **defaults** (what values cascade).

```ts
export abstract class Scope {
  readonly path: string;                                   // diagnostics only; never emitted, never hashed
  use<P, R>(component: Component<P, R>, props: P): R;
  adopt(detached: DetachedScope): void;
}

export class Blueprint extends Scope {                     // placement: document root
  constructor(props?: { previews?: RootPreviews });
  manifest(): readonly ManifestEntry[];                    // answers "is this in the output?"
  escapeRoot(fields: JsonObject): this;
  toYaml(): ResultType<SynthedBlueprint, BlueprintInvalid>;
  synth(p: { outFile: string }): Promise<ResultType<SynthOutcome, BlueprintInvalid | BlueprintWriteFailed>>;
  check(p: { file: string }): Promise<ResultType<CheckOutcome, BlueprintInvalid | BlueprintReadFailed>>;
}
export class Project { constructor(scope: Blueprint, name: string); }         // holds environments only
export class Environment extends Scope {                   // placement: projects[].environments[]
  constructor(project: Project, name: string, props?: { networking?: Networking; permissions?: Permissions });
}
export class Ungrouped extends Scope { constructor(scope: Blueprint); }        // placement: `ungrouped`
export class Defaults extends Scope {                      // placement-transparent; label is diagnostics-only
  constructor(scope: Scope, label: string, defaults: ScopeDefaults);
}
export interface ScopeDefaults {
  readonly repo?: string; readonly branch?: string; readonly rootDir?: string;
  readonly region?: Region; readonly plan?: ServerPlan;
  readonly autoDeployTrigger?: AutoDeployTrigger; readonly buildFilter?: BuildFilter;
}
```

Resolution: **explicit props > nearest `Defaults` ancestor > … > root > Render's default.** A default is
applied per field only to descendants whose shape legally carries it (spec §4.8), so a `region` default
silently skips static sites instead of producing an invalid document; a default reaching zero descendants
is a warning. Because a resource has exactly one parent, the spec's "define a resource in exactly one
location" rule is structural, not checked.

### 2.2 Resource classes — one per disjoint schema shape

```ts
class WebService extends ServiceConstruct   { constructor(s: Scope, name: string, p: WebServiceProps); }
class PrivateService extends ServiceConstruct { /* emits type: pserv */ }
class Worker extends ServiceConstruct       { }
class CronJob extends ServiceConstruct      { constructor(s, name, p: CronJobProps); }   // schedule required
class StaticSite extends ServiceConstruct   { constructor(s, name, p: StaticSiteProps); } // no plan/region
class KeyValue extends Construct            { constructor(s, name, p: KeyValueProps); }  // ipAllowList required
class Postgres extends Construct            { constructor(s, name, p: PostgresProps); }
class EnvVarGroup extends Construct         { constructor(s, name, p: EnvVarGroupProps); }
```

There is no `Redis` class, no `env` prop, no `autoDeploy`, no `pullRequestPreviewsEnabled` and no service
`previewPlan`: the deprecated forms (spec §13) are unreachable from the type system.

Build sources are values, so they are shareable across services and files. `repo` and `image` cannot both
be set because they are different constructors of one union (the JSON Schema fails to enforce this):

```ts
export const Source: {
  repo(p: { runtime: LanguageRuntime; buildCommand?: string; startCommand?: string;
            repo?: string; branch?: string; rootDir?: string; preDeployCommand?: string }): RepoSource;
  dockerfile(p: { dockerfilePath?: string; dockerContext?: string; dockerCommand?: string;
                  repo?: string; branch?: string; registryCredential?: RegistryCredentialRef }): DockerfileSource;
  image(p: { url: string; creds?: RegistryCredentialRef }): ImageSource;
};
```

### 2.3 Mutation methods

Every mutator is **total**, returns `this`, records intent, and cannot fail. Nothing throws; nothing
returns a `Result`. Validation is deferred wholesale to `synth()` so constructors can never fail
(doctrine §5.4, §5.12).

```ts
// all services
addEnv(key: string, source: EnvSource | string | number): this;   // five YAML shapes, one method
importGroup(group: EnvVarGroupTarget): this;                      // -> { fromGroup: <name> }
buildFilter(f: BuildFilter): this;
autoDeploy(trigger: AutoDeployTrigger): this;                     // never the deprecated boolean
escape(fields: JsonObject): this;

// WebService | PrivateService | Worker  (serverService only)
scaling(s: { minInstances: number; maxInstances: number;
             targetCPUPercent?: number; targetMemoryPercent?: number }): this;
instances(n: number): this;                                       // -> numInstances
disk(d: { name: string; mountPath: string; sizeGB?: number }): this;
maxShutdownDelaySeconds(n: number): this;
previews(p: { generation?: PreviewGeneration; plan?: ServerPlan; instances?: number }): this;

// WebService only — deliberately stricter than the schema (prose restricts these; spec §16 F)
healthCheck(path: `/${string}`): this;   ipAllowList(rules: readonly IpRule[]): this;
addDomain(d: string): this;   renderSubdomain(p: "enabled" | "disabled"): this;
maintenanceMode(m: { enabled?: boolean; uri?: string }): this;   initialDeployHook(c: string): this;

// StaticSite only
addRoute(r: { type: "redirect" | "rewrite"; source: string; destination: string }): this;
addHeader(h: { path: string; name: string; value: string }): this;
previews(p: { generation?: PreviewGeneration }): this;   // narrower than the server overload

// Postgres
addReadReplica(name: string): ReadReplica;               // returns a full DatabaseTarget
highAvailability(enabled: boolean): this;   ipAllowList(rules: readonly IpRule[]): this;
previews(p: { plan?: PostgresPlan; diskSizeGB?: number }): this;  // -> flat previewPlan/previewDiskSizeGB

// KeyValue:    previews(p: { plan?: KeyValuePlan }): this        // -> flat previewPlan (current for KV)
// EnvVarGroup: set(key: string, value: GroupEnvValue): this
```

### 2.4 References are properties; targets are interfaces

```ts
export type EnvSource =
  | { readonly kind: "value"; readonly value: string | number; readonly previewValue?: string | number }
  | { readonly kind: "secret" }                                        // -> sync: false
  | { readonly kind: "generated" }                                     // -> generateValue: true
  | { readonly kind: "fromDatabase"; readonly name: string; readonly property: DatabaseProperty;
      readonly external: boolean }
  | { readonly kind: "fromService"; readonly name: string; readonly type: ServiceRefType;
      readonly property: ServiceProperty; readonly external: boolean }
  | { readonly kind: "fromServiceEnvVar"; readonly name: string; readonly type: ServiceRefType;
      readonly envVarKey: string; readonly external: boolean };

export type GroupEnvValue = Extract<EnvSource, { kind: "value" | "generated" }> | string | number;

export interface DatabaseTarget {          // Postgres | ReadReplica | External.database(...)
  readonly connectionString: EnvSource; readonly connectionPoolString: EnvSource;
  readonly host: EnvSource; readonly port: EnvSource;
  readonly user: EnvSource; readonly password: EnvSource; readonly database: EnvSource;
}
export interface NetworkServiceTarget {    // WebService | PrivateService | External.service(...)
  readonly host: EnvSource; readonly port: EnvSource; readonly hostport: EnvSource;
  envVar(key: string): EnvSource;
}
export interface KeyValueTarget { readonly connectionString: EnvSource }   // no envVar(): KV has none
export interface EnvVarGroupTarget { readonly groupName: string }

export const Env: { value(v: string | number, o?: { preview: string | number }): EnvSource;
                    secret(): EnvSource; generated(): EnvSource };
export const External: {                   // spec §12: refs may point outside the blueprint
  service(name: string, type: ServiceRefType): NetworkServiceTarget;
  database(name: string): DatabaseTarget;  keyValue(name: string): KeyValueTarget;
  group(name: string): EnvVarGroupTarget;
  registryCredential(name: string): RegistryCredentialRef;   // never definable in render.yaml
};
export const RenderEnv: { readonly EXTERNAL_HOSTNAME: "RENDER_EXTERNAL_HOSTNAME"; /* 15 more */ };
```

`Worker` and `CronJob` expose no `.host`/`.port`/`.hostport` (prose restricts them to web + private
services). `property` and `envVarKey` are separate union members, so the XOR the JSON Schema fails to
enforce is a compile-time impossibility.

### 2.5 The cross-file problem, solved two ways

A construct needs a scope at construction, but `apps/api/render.ts` must not import the root. Both answers
rest on one fact: **a reference is a `{name, property}` pair, so it does not require the target to be
registered.** That is why deferred registration is tractable here and is not in cdk8s.

**(a) Components — the scope arrives late.** The default. A leaf file exports a *recipe*, not a resource.

```ts
export interface Component<P, R> { (scope: Scope, props: P): R }
export declare function defineComponent<P, R>(build: (scope: Scope, props: P) => R): Component<P, R>;
// consumed as: scope.use(component, props)
```

Because deps are declared as `DatabaseTarget` / `NetworkServiceTarget` interfaces, a component is
indifferent to whether a dependency lives in this blueprint, in another file, or only in the workspace
(`External.*`). That interface is the whole composability story.

**(b) Detached scopes — the resource is a plain exported value**, for teams that insist on `export const api`:

```ts
export declare function detachedScope(label: string): DetachedScope;   // a Scope with no root
// leaf:  const local = detachedScope("apps/api"); export const api = new WebService(local, "api", {...});
// root:  blueprint.adopt(local);   // or  prodEnv.adopt(local)
```

Adoption reparents; the adopter's defaults then cascade *beneath* the detached scope's own. A detached
scope never adopted is a synth **error** — recovering the "declared but not returned" check that an
explicit `resources: [...]` array would give.

### 2.6 Synth boundary

```ts
export type FindingCode =
  | "DuplicateResourceName" | "DanglingReference" | "UnadoptedScope" | "ForeignScope"
  | "DuplicateEnvKey" | "ScalingRangeInverted" | "ScalingWithDisk" | "DiskSizeNotAllowed"
  | "TooManyReadReplicas" | "OutOfRange" | "MissingBuildCommand" | "DefaultAppliesToNothing"
  | "EscapeHatchOverride" | "EscapeHatchDeprecatedField" | "UnknownRenderProvidedVar"
  | "BranchBreaksPreviews" | "InertPreviewBlock" | "EmptyBlueprint";

export interface Finding {
  readonly code: FindingCode; readonly severity: "error" | "warning";
  readonly path: string;      // "acme/production/backend/api/envVars[DATABASE_URL]"
  readonly field: string; readonly message: string;
}

export class BlueprintInvalid extends TaggedError("BlueprintInvalid")<{
  readonly message: string; readonly findings: readonly Finding[] }> {}
export class BlueprintWriteFailed extends TaggedError("BlueprintWriteFailed")<{
  readonly message: string; readonly path: string; readonly cause: unknown }> {}
export class BlueprintReadFailed extends TaggedError("BlueprintReadFailed")<{ /* same fields */ }> {}

export interface SynthedBlueprint { readonly yaml: string; readonly warnings: readonly Finding[] }
export interface SynthOutcome { readonly status: "written" | "unchanged"; readonly path: string;
                                readonly warnings: readonly Finding[] }
export interface CheckOutcome { readonly status: "clean" | "drift"; readonly diff: string;
                                readonly warnings: readonly Finding[] }
```

One error class per action the caller can take, not one per rule: every `error`-severity finding leads to
the same action (print, exit 1), so the codes are *data* inside `BlueprintInvalid`. A deliberate reading of
doctrine §5.2, not an oversight.

---

## 3. Usage example — the canonical scenario

### 3a. `apps/api/render.ts`

```ts
import { defineComponent, WebService, Source, Env, RenderEnv,
  type Component, type Scope, type DatabaseTarget, type KeyValueTarget, type EnvVarGroupTarget,
} from "render-blueprint";

export interface ApiDeps {
  readonly db: DatabaseTarget; readonly cache: KeyValueTarget; readonly settings: EnvVarGroupTarget;
}
export interface ApiParts { readonly api: WebService }

export const apiComponent: Component<ApiDeps, ApiParts> = defineComponent(
  (scope: Scope, deps: ApiDeps): ApiParts => {
    const api = new WebService(scope, "api", {
      // repo + branch cascade from the root's Defaults scope
      source: Source.repo({ runtime: "node", buildCommand: "pnpm build", startCommand: "pnpm start" }),
    });
    api.healthCheck("/healthz");
    api.scaling({ minInstances: 1, maxInstances: 3, targetCPUPercent: 70 });
    api.addEnv("DATABASE_URL", deps.db.connectionString);
    api.addEnv("REDIS_URL", deps.cache.connectionString);
    api.addEnv("STRIPE_KEY", Env.secret());
    api.addEnv("APP_HOST", api.envVar(RenderEnv.EXTERNAL_HOSTNAME));   // self-reference
    api.importGroup(deps.settings);
    api.previews({ plan: "starter" });
    return { api };
  },
);
```

### 3b. `render.ts` (root)

```ts
import { Blueprint, Defaults, Postgres, KeyValue, EnvVarGroup, Worker, CronJob, StaticSite,
  Source, Env, External } from "render-blueprint";
import { apiComponent } from "./apps/api/render.ts";

const blueprint = new Blueprint({ previews: { generation: "automatic", expireAfterDays: 7 } });

const db = new Postgres(blueprint, "main-db", {
  plan: "basic-1gb", region: "oregon", postgresMajorVersion: "16",
});
db.addReadReplica("main-db-replica");

const cache = new KeyValue(blueprint, "cache", {
  plan: "free", ipAllowList: [], maxmemoryPolicy: "allkeys-lru",
});

const settings = new EnvVarGroup(blueprint, "shared-settings", {});
settings.set("LOG_LEVEL", "info").set("SESSION_SECRET", Env.generated());

// One defaults scope removes repo/branch/region from the four resources below it.
const backend = new Defaults(blueprint, "backend", {
  repo: "https://github.com/acme/api", branch: "main", region: "oregon",
});

const { api } = backend.use(apiComponent, { db, cache, settings });

const jobs = new Worker(backend, "jobs", {
  source: Source.dockerfile({ dockerfilePath: "./Dockerfile.jobs" }),
});
jobs.addEnv("API_URL", api.hostport);
jobs.addEnv("AUTH_HOST", External.service("legacy-auth", "pserv").host);   // not in this blueprint

new CronJob(backend, "nightly-report", {
  schedule: "0 2 * * *",
  source: Source.repo({ runtime: "node", startCommand: "pnpm report" }),
});

const site = new StaticSite(backend, "web", {           // the `region` default is filtered out here
  buildCommand: "pnpm build", staticPublishPath: "./dist",
});
site.addRoute({ type: "rewrite", source: "/*", destination: "/index.html" });
site.addHeader({ path: "/*", name: "X-Frame-Options", value: "DENY" });

const result = process.argv.includes("--check")
  ? await blueprint.check({ file: "render.yaml" })
  : await blueprint.synth({ outFile: "render.yaml" });

process.exitCode = result.match({
  ok: (outcome) => {
    for (const w of outcome.warnings) console.warn(`warn ${w.path}: ${w.message}`);
    return outcome.status === "drift" ? 2 : 0;          // Terraform --detailed-exit-code semantics
  },
  err: (error) => error.match({
    BlueprintInvalid: (e) => {
      for (const f of e.findings) console.error(`${f.path}: [${f.code}] ${f.message}`);
      return 1;
    },
    BlueprintWriteFailed: (e) => { console.error(e.message); return 1; },
    BlueprintReadFailed:  (e) => { console.error(e.message); return 1; },
  }),
});
```

### 3c. A reusable pattern (separate blueprint, so the canonical output stays exact)

```ts
// infra/patterns.ts
export interface WebWithDatabaseProps {
  readonly name: string; readonly dbName: string;
  readonly source: RepoSource; readonly plan?: ServerPlan; readonly dbPlan?: PostgresPlan;
}
export interface WebWithDatabaseParts { readonly service: WebService; readonly database: Postgres }

export const webWithDatabase: Component<WebWithDatabaseProps, WebWithDatabaseParts> =
  defineComponent((scope: Scope, p: WebWithDatabaseProps): WebWithDatabaseParts => {
    const database = new Postgres(scope, p.dbName, { plan: p.dbPlan ?? "basic-1gb" });
    const service = new WebService(scope, p.name, { source: p.source, plan: p.plan });
    service.addEnv("DATABASE_URL", database.connectionString);
    return { service, database };
  });

// consumer — parts come back live and still mutable
const { service } = someScope.use(webWithDatabase, {
  name: "admin", dbName: "admin-db", source: Source.repo({ runtime: "node" }),
});
service.healthCheck("/up");
```

Both names come from the caller's props. Nothing is derived from the tree path; nothing is hashed.

---

## 4. What it hides

The four disjoint schema shapes and `anyOf` branch selection; the `(type, runtime)` discriminator and the
static-site double-match trap (spec §0.2) — the emitter guarantees a static site never receives a
server-only key; the `pserv` / `redis` / `numInstances` / `sync: false` spellings; the whole deprecated
field set; the env-var map-to-list conversion and its five YAML encodings; the fact that datastores use
flat `previewPlan` while services use nested `previews.plan`; placement bookkeeping (root vs
`projects[].environments[]` vs `ungrouped`) and the "exactly one location" rule; defaults resolution and
per-shape filtering; `postgresMajorVersion` having to be a *string*; `ipAllowList: []` meaning
"private-network only" and so never being pruned as an empty array; construct-path computation for
diagnostics; the drift diff, its secret redaction, and the generated-file header comment.

---

## 5. Mistake matrix

| # | Authoring mistake | Caught by |
| --- | --- | --- |
| 1 | `cache.host` (wrong property for a Key Value ref) | **Compile.** `KeyValueTarget` exposes only `connectionString`. |
| 2 | `cron.disk({...})` | **Compile.** `disk()` exists only on `WebService`/`PrivateService`/`Worker`. |
| 3 | `plan` on a static site, explicit or cascading | **Compile** for the explicit prop (`StaticSiteProps` has no `plan`/`region`); **silently filtered** for a cascading default, with a `DefaultAppliesToNothing` warning if it reaches nobody. |
| 4 | `fromService` pointing at a name nothing declares, not wrapped in `External.*` | **Synth error** `DanglingReference`, at the env var's construct path. |
| 5 | Two resources named `api` | **Synth error** `DuplicateResourceName`, both paths listed — works cross-file and cross-scope. |
| 6 | `new CronJob(s, "x", { source })` with no `schedule` | **Compile.** Required in `CronJobProps`. |
| 7 | `group.set("STRIPE_KEY", Env.secret())` | **Compile.** `GroupEnvValue` excludes the `secret` variant (Render ignores `sync: false` in groups). |
| 8 | Both a literal value and `generateValue` on one variable | **Compile.** `EnvSource` variants are disjoint; a mixed one is unconstructable. |
| 9 | `scaling({ minInstances: 5, maxInstances: 2 })` | **Synth error** `ScalingRangeInverted`. Not compile-time: the fields are `number`, not literals. |
| 10 | Referencing a service declared in another file | **Works by construction.** A ref is `{name, property}`; the target need not be registered, and component deps are `…Target` interfaces. |
| 11 | Constructing against a scope of a *different* `Blueprint` | **Synth error** `ForeignScope` — the resource is unreachable from the root being synthed. Not compile-time: every scope has the same static type. |
| 12 | `api.envVar("RENDER_EXTRENAL_HOSTNAME")` (typo) | **Compile** if written `RenderEnv.EXTERNAL_HOSTNAME`; **synth warning** `UnknownRenderProvidedVar` for a raw `RENDER_*` string that is not one of the 16 documented defaults; otherwise **passes through to Render** (the key may legitimately be a user-defined var on the target). |
| 13 | `healthCheck("healthz")` (no leading slash) | **Compile.** Parameter type is `` `/${string}` ``. |
| 14 | `disk(...)` plus `scaling(...)` on one service | **Synth error** `ScalingWithDisk`. |
| 15 | `db.previews({ diskSizeGB: 7 })` (not 1, not a multiple of 5) | **Synth error** `DiskSizeNotAllowed` — prose-only rule; the schema encodes only `minimum: 1`. |
| 16 | Six `addReadReplica` calls | **Synth error** `TooManyReadReplicas` (max 5, not in the schema). |
| 17 | `addEnv("DATABASE_URL", …)` twice on one service | **Synth error** `DuplicateEnvKey` — never a silent last-write-wins. |
| 18 | `Source.repo({ runtime: "node" })` with no `buildCommand`; or `branch` set on a service with previews on | **Synth warnings** `MissingBuildCommand`, `BranchBreaksPreviews` (both prose-only rules; spec §4.1, §11). |
| 19 | Detached scope built in a leaf file, never adopted | **Synth error** `UnadoptedScope`. |
| 20 | `escape({ env: "node" })` — smuggling a deprecated field | **Synth error** `EscapeHatchDeprecatedField`. |
| 21 | `healthCheckPath` on a worker | **Compile.** `healthCheck()` is `WebService`-only, deliberately stricter than the schema (spec §16 F). |
| 22 | `targetCPUPercent: 120` | **Synth error** `OutOfRange` (1–90). See open decision 3. |
| 23 | `previews({ instances: 2 })` on an autoscaled service | **Passes through.** Render ignores it; modelling it is not worth the noise. |

---

## 6. Preview and environment overrides

Every override is a mutator on the resource it overrides, so overrides sit next to what they modify:

```ts
new Blueprint({ previews: { generation: "automatic", expireAfterDays: 7 } });  // root previews
api.previews({ generation: "automatic", plan: "starter", instances: 1 });      // -> previews {…, numInstances}
site.previews({ generation: "manual" });                                       // generation only
db.previews({ plan: "free", diskSizeGB: 5 });      // -> flat previewPlan / previewDiskSizeGB
cache.previews({ plan: "free" });                  // -> flat previewPlan
api.addEnv("MODE", Env.value("prod", { preview: "dev" }));   // -> value + previewValue
```

`previews()` unifies three YAML spellings behind one method name while emitting the current form for each
shape (service `previewPlan` is deprecated; datastore `previewPlan` is not).

Long-lived environments are a placement scope, and per-environment *values* are plain TypeScript — call one
component once per environment with different props. No override DSL is introduced:

```ts
const acme = new Project(blueprint, "acme");
for (const [env, plan] of [["staging", "free"], ["production", "2c-4g"]] as const) {
  const scope = new Environment(acme, env, { permissions: { protection: "enabled" } });
  new Defaults(scope, "backend", { plan, repo: "https://github.com/acme/api" })
    .use(apiComponent, { db, cache, settings });
}
```

---

## 7. Escape hatch

```ts
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
export interface JsonObject { readonly [key: string]: JsonValue }

api.escape({ someNewRenderField: { nested: true } });   // merged into this service's emitted object
blueprint.escapeRoot({ version: "1" });                 // merged into the document root
```

`JsonObject`'s value type is a concrete recursive union, so it is neither `unknown` nor
`Record<string, unknown>`. The merge is shallow and applied **last**, so it can override a modeled field —
doing so emits an `EscapeHatchOverride` warning naming the key. Escaped keys are still subject to the
deprecated-field blocklist (mistake 20) and never bypass name or reference validation. There is no
post-synth resolver visiting arbitrary values: cdk8s's `IResolver` exists because the typed API had a
ceiling, and a per-construct merge is the smallest thing that removes the ceiling without making the
output unpredictable.

---

## 8. Trade-offs

**Implicit registration** (survey §4.6). Conceded, not solved. `new Worker(backend, "jobs", …)` mutates
`backend`, and one expression no longer tells you whether the resource is in the output. Three
mitigations: `blueprint.manifest()` returns a flat readonly list of `{path, kind, name, placement}` that
answers the question in one call; the detached-scope path turns the *unregistered* case into a hard error;
and the emitted `render.yaml` is committed, so the PR diff shows the real answer. None is as good as
Railway's explicit `resources: [...]`. This is the largest cost of the design and it is paid on every read.

**Constructor side effects** (survey §4.3), also against the survey's stated preference for inert values.
The defence is narrow: the effect is confined to an in-memory tree the reader created a few lines earlier
— no I/O, no `await`, no ambient global, no import-time platform contact. The config file stays a pure
function of its imports (**INFERRED**, assuming user code avoids `Date.now`). `detachedScope()` restores
the plain-exported-value property, at the cost of a second concept to learn.

**Subclass hierarchies** (survey §4.8). Rejected outright — the main departure from CDK. The library
exports no extensible base class, no `protected` hooks, no abstract resource to subclass. Reuse is
`defineComponent`, a function `(scope, props) => parts`; `webWithDatabase` in §3c is a function, not
`class WebWithDatabase extends Construct`. The two habits that age CDK-family APIs badly — name derivation
and inheritance — are both removed.

**Mutation makes the blueprint order-dependent.** Real, and managed by making the order that matters in
TypeScript exactly the order that matters in YAML. Append-only mutators (`addRoute`, `addHeader`,
`addDomain`, `addReadReplica`) emit in insertion order, which is what Render's route matching needs anyway.
Keyed mutators (`addEnv`) reject a duplicate key rather than overwriting. Scalar setters (`healthCheck`,
`scaling`) overwrite, and calling one twice is a warning. The one genuinely order-sensitive construct left
is `Defaults`: a `Defaults` scope created *after* a resource does not apply to it, because the resource
already has a parent. That is a surprise and the docs must say so.

**Ceremony, and TypeScript costs.** `new WebService(backend, "api", {…})` repeats the name in the variable
and the string, and every resource carries a scope argument that is noise in the common single-scope case;
survey shapes (a) and (c) both beat this on a small blueprint, and the tree only starts paying for itself
at roughly a dozen resources or the first `Defaults` scope. `isolatedDeclarations: true` also forces an
explicit return type on every public method, including the `this`-returning chains and the generic
`use<P, R>`; and `exactOptionalPropertyTypes` plus the ban on `...(cond ? {x} : {})` (anti-slop rule 2)
makes defaults merging awkward — omission and `undefined` differ, so the merge needs explicit per-field
branches.

---

## 9. Open decisions

1. **Should `Defaults` cascade env vars** (`scope.addEnvToAll(...)`)? The most-requested cdk8s-style
   feature and the most surprising one. Leaning no.
2. **Does `adopt` reparent or deep-copy?** Reparenting means a detached scope is adoptable exactly once;
   copying allows fan-out but breaks reference identity for diagnostics.
3. **Literal unions (`1 | … | 90`) for `targetCPUPercent` / `maxShutdownDelaySeconds`** to move mistake 23
   to compile time, versus a synth check. Large unions hurt error messages and editor performance; the
   matrix assumes synth.
4. **Emission order of `services[]`**: declaration order (author-friendly diffs) or sorted by name
   (`--check` friendliness against a hand-edited file). Spec §16 L says Render's ordering is unspecified.
5. **Emit `version: "1"`?** Schema-only and undocumented (spec §16 D); currently reachable only via
   `escapeRoot`.
6. **Bundle Render's JSON Schema as a post-synth assertion** rather than trusting the emitter — cheap
   defence in depth, but adds a dependency and a second error vocabulary.
7. **Name-uniqueness scope**: per kind, or global across services + databases + groups (spec §16 A is
   silent). Currently assumed global, which is stricter than Render and may reject valid files.
8. **`defineComponent` with no props** — a `void` overload versus always requiring a props object.
