# Design B — lowercase factories + typed cross-resource references

Seed: `iac-dx-survey.md` §5 sketch (c), pushed to a full surface. Constraint: **optimize for the
common case — a web service, a database, a worker, and secrets.**

## 1. Design thesis

One lowercase factory per resource kind, `(name, config)`, returning an inert value whose
**properties are the typed references** other resources consume. A reference is never a string you
write; it is a property you reach for, and the property set differs per source kind, so
`fromDatabase` vs `fromService` and the legal `property` per source are both structural. Resources
are plain data with no construction side effects, so a leaf file exports one and the root assembles
it. `withDefaults` deletes the `region`/`repo`/`branch`/`plan` repetition that dominates real
blueprints. `blueprint({ resources })` is the one explicit collection; synth is the one fallible call.

## 2. Interface signature

### 2.1 Reference values — the core of the design

Two inert value types map 1:1 onto the two YAML reference forms. `fromService`'s `property` XOR
`envVarKey` is structural, not a runtime check.

```ts
export type DatabaseProperty = "connectionString" | "connectionPoolString" | "host" | "port" | "user" | "password" | "database";
export type ServiceProperty  = "host" | "port" | "hostport" | "connectionString";
export type ReferenceableServiceType = "web" | "pserv" | "worker" | "cron" | "static" | "keyvalue"; // dpg/job/redis unexposed

export interface DatabaseReferenceValue {
  readonly reference: "fromDatabase"; readonly name: string; readonly property: DatabaseProperty;
}
export type ServiceReferenceValue =    // the XOR, as a two-member union
  | { readonly reference: "fromService"; readonly name: string; readonly type: ReferenceableServiceType; readonly property: ServiceProperty }
  | { readonly reference: "fromService"; readonly name: string; readonly type: ReferenceableServiceType; readonly envVarKey: string };
```

Reference **handles** are what a resource exposes. The property set is the per-source `property` enum
(spec §6.2) narrowed to the *prose* rules, not the looser schema:

```ts
export interface PostgresReference {          // Postgres instance and its read replicas
  readonly connectionString: DatabaseReferenceValue;  readonly connectionPoolString: DatabaseReferenceValue;
  readonly host: DatabaseReferenceValue;  readonly port: DatabaseReferenceValue;  readonly user: DatabaseReferenceValue;
  readonly password: DatabaseReferenceValue;  readonly database: DatabaseReferenceValue;
}
export interface KeyValueReference {          // no hostport, no user/password/database
  readonly connectionString: ServiceReferenceValue;
  readonly host: ServiceReferenceValue;       // INFERRED: schema-permitted; prose documents only connectionString
  readonly port: ServiceReferenceValue;
}
export interface HttpServiceReference {       // web + private service only (spec §6.2 prose)
  readonly host: ServiceReferenceValue;  readonly port: ServiceReferenceValue;  readonly hostport: ServiceReferenceValue;
  readonly envVar: (key: string) => ServiceReferenceValue;              // a key declared on that service
  readonly renderVar: (key: RenderProvidedKey) => ServiceReferenceValue; // closed union of the 16 Render defaults (§6.6)
}
export interface OpaqueServiceReference {     // worker, cron, static site: no host/port/hostport
  readonly envVar: (key: string) => ServiceReferenceValue;
  readonly renderVar: (key: RenderProvidedKey) => ServiceReferenceValue;
}
```

`db.hostport`, `cache.user` and `jobs.host` do not exist. All three are property errors at the call
site, with no validator involved.

### 2.2 Resource values

A resource is its reference handle plus identity. `kind` is both the discriminator and the brand that
keeps external handles and sub-resources out of `resources: [...]`.

```ts
export interface WebService       extends HttpServiceReference   { readonly kind: "web";      readonly name: string }
export interface PrivateService   extends HttpServiceReference   { readonly kind: "pserv";    readonly name: string }
export interface Worker           extends OpaqueServiceReference { readonly kind: "worker";   readonly name: string }
export interface CronJob          extends OpaqueServiceReference { readonly kind: "cron";     readonly name: string }
export interface StaticSite       extends OpaqueServiceReference { readonly kind: "static";   readonly name: string }
export interface KeyValueStore    extends KeyValueReference      { readonly kind: "keyvalue"; readonly name: string }
export interface PostgresDatabase extends PostgresReference      { readonly kind: "postgres"; readonly name: string }
export interface EnvironmentGroup                                { readonly kind: "envGroup"; readonly name: string }
export interface ReadReplica      extends PostgresReference      { readonly kind: "readReplica"; readonly name: string }

export type BlueprintResource = WebService | PrivateService | Worker | CronJob | StaticSite
  | KeyValueStore | PostgresDatabase | EnvironmentGroup;   // ReadReplica deliberately excluded
```

### 2.3 Factories, defaults scope, value helpers

```ts
export interface ResourceFactories {
  readonly web:            (name: string, config: WebConfig) => WebService;
  readonly privateService: (name: string, config: PrivateServiceConfig) => PrivateService;
  readonly worker:         (name: string, config: WorkerConfig) => Worker;
  readonly cron:           (name: string, config: CronConfig) => CronJob;
  readonly staticSite:     (name: string, config: StaticSiteConfig) => StaticSite;
  readonly keyValue:       (name: string, config: KeyValueConfig) => KeyValueStore;
  readonly postgres:       (name: string, config?: PostgresConfig) => PostgresDatabase;
  readonly envGroup:       (name: string, config: EnvGroupConfig) => EnvironmentGroup;
  readonly withDefaults:   (defaults: ResourceDefaults) => ResourceFactories;   // nestable, shallow-merged
}
export const withDefaults: (defaults: ResourceDefaults) => ResourceFactories;
export const web: (name: string, config: WebConfig) => WebService;   // …and the other seven, default-free

export interface ResourceDefaults {
  readonly region?: Region;  readonly repo?: string;  readonly branch?: string;  readonly rootDir?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;  readonly ipAllowList?: readonly IpAllowListEntry[];
  readonly buildFilter?: BuildFilter;  readonly plan?: PlanDefaults;
}
export interface PlanDefaults {   // one key per factory: the four plan enums differ, so they cannot share a slot
  readonly web?: ServerPlan;  readonly worker?: WorkerPlan;  readonly privateService?: WorkerPlan;
  readonly cron?: CronPlan;   readonly keyValue?: KeyValuePlan;  readonly postgres?: PostgresPlan;
}

// three sentinels for Render's three "the value lives elsewhere" forms
export const literal:     (value: string | number, options?: LiteralOptions) => LiteralValue;  // value + previewValue
export const secret:      () => SecretValue;             // -> sync: false
export const generated:   () => GeneratedValue;          // -> generateValue: true
export const readReplica: (name: string) => ReadReplica; // declares a replica AND is referenceable

export type EnvValue = string | number | LiteralValue | SecretValue | GeneratedValue
  | DatabaseReferenceValue | ServiceReferenceValue;
export type EnvGroupValue = string | number | LiteralValue | GeneratedValue;  // no secret(), no refs (spec §10)
export interface EnvironmentMap      { readonly [key: string]: EnvValue }
export interface EnvGroupEnvironment { readonly [key: string]: EnvGroupValue }
```

Defaults are **matrix-filtered** (spec §4.8): `region`/`plan` never reach a static site;
`repo`/`branch`/`rootDir`/`autoDeployTrigger`/`buildFilter` never reach Key Value or Postgres. A
per-resource value always wins over a default.

### 2.4 Out-of-blueprint references, and self-reference

External handles carry refs but **no `kind`**, so they cannot be listed as resources.
`registryCredential` is external-only because it is never definable in `render.yaml` (spec §12).

```ts
export interface ExternalReferences {
  readonly web: (name: string) => HttpServiceReference;       // same for privateService
  readonly worker: (name: string) => OpaqueServiceReference;  // same for cron, staticSite
  readonly keyValue: (name: string) => KeyValueReference;
  readonly postgres: (name: string) => PostgresReference;     // also covers read replicas by name
  readonly envGroup: (name: string) => ExternalEnvGroupReference;
  readonly registryCredential: (name: string) => RegistryCredentialReference;
}
export const external: ExternalReferences;                    // nine members; three elided above
```

Self-reference: `env` accepts a map **or a function of `self`**, typed to the enclosing kind's handle.
No mutation, no cycle, no untyped sentinel — and `self.host` on a worker stays a compile error.

```ts
readonly env?: EnvironmentMap | ((self: HttpServiceReference) => EnvironmentMap);
```

### 2.5 Root, synth, and the Result types

```ts
export const blueprint:   (config: BlueprintConfig) => Blueprint;   // total: never fails, never validates
export const group:       (label: string, members: readonly BlueprintResource[]) => ResourceGroup;  // structural only
export const project:     (name: string, config: ProjectConfig) => Project;
export const environment: (name: string, config: EnvironmentConfig) => Environment;

export interface BlueprintConfig {
  readonly resources?: readonly (BlueprintResource | ResourceGroup)[];   // root-level placement
  readonly projects?: readonly Project[];                                // projects[].environments[]
  readonly ungrouped?: readonly (BlueprintResource | ResourceGroup)[];
  readonly previews?: { readonly generation?: PreviewGeneration; readonly expireAfterDays?: number };
  readonly extraFields?: JsonObject;
}

// Factories are total by construction, so only these three are fallible (better-result.md §5, §12).
export const synthesize:    (value: Blueprint) => ResultType<SynthesisReport, BlueprintInvalid>;
export const writeToFile:   (value: Blueprint, options: WriteOptions)
  => Promise<ResultType<WriteReport, BlueprintInvalid | BlueprintWriteFailed>>;
export const checkForDrift: (value: Blueprint, options: CheckOptions)
  => Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>>;

export class BlueprintInvalid extends TaggedError("BlueprintInvalid")<{
  readonly message: string;
  readonly issues: readonly [ValidationIssue, ...ValidationIssue[]];   // non-empty; every problem, not the first
}> {}
export class BlueprintWriteFailed    extends TaggedError("BlueprintWriteFailed")<FileFailureProps> {}
export class BlueprintFileUnreadable extends TaggedError("BlueprintFileUnreadable")<FileFailureProps> {}

export interface ValidationIssue {
  readonly code: ValidationCode;   // "DanglingReference" | "DuplicateResourceName" | … one literal per rule in §5
  readonly at: ResourcePath;       // { resource, field } — names are the only author coordinates we have
  readonly message: string;
}
export interface SynthesisReport { readonly yaml: string; readonly warnings: readonly ValidationWarning[] }
export type DriftReport =
  | { readonly status: "clean" }
  | { readonly status: "drift"; readonly diff: string; readonly immutableFieldChanges: readonly ImmutableFieldChange[] };
```

One error class per *caller decision*, not per rule: every validation failure is handled identically
(print, exit 1), so `BlueprintInvalid` carries a non-empty issue list and synth reports everything at
once. Drift is an outcome, not an error. `checkForDrift` also classifies changes to Render's immutable
fields (`type`, `runtime`, `region`, db `name`/`user`/`databaseName`/`postgresMajorVersion`, spec
§9/§12), because the committed file is the only baseline the library ever gets.

### 2.6 Renames — everything else is Render's own field name, verbatim

| TS | YAML | why |
| --- | --- | --- |
| `privateService(…)` | `type: pserv` | `pserv` is undecodable jargon |
| `staticSite(…)` | `type: web` + `runtime: static` | `type: web` is overloaded (spec §0) |
| `keyValue(…)` | `type: keyvalue` | casing consistency |
| `env: { K: v }` | `envVars: [{key, …}]` | list→map is the single clearest ergonomic win |
| `envGroups: [g]` | `envVars: [{fromGroup}]` | a keyless list entry a map cannot hold |
| `instances` | `numInstances` | per brief |
| `secret()` | `sync: false` | a boolean named `sync` meaning "secret" is actively bad |
| `previews.{plan,diskSizeGB}` on Postgres/Key Value | `previewPlan` / `previewDiskSizeGB` | Render spells one concept two ways (spec §16 M) |
| `extraFields` | (merged into the mapping) | not a Render field |

## 3. Usage example — the canonical scenario

```ts
// infra/defaults.ts
import { withDefaults, type ResourceFactories } from "render-blueprint";

export const acme: ResourceFactories = withDefaults({
  region: "oregon",
  repo: "https://github.com/acme/api",
  branch: "main",
  plan: { postgres: "basic-1gb", keyValue: "free" },
});
```

```ts
// apps/api/render.ts — declared here, assembled at the root
import { secret, type WebService, type PostgresDatabase, type KeyValueStore, type EnvironmentGroup } from "render-blueprint";
import { acme } from "../../infra/defaults.ts";

export interface ApiDependencies {
  readonly db: PostgresDatabase; readonly cache: KeyValueStore; readonly settings: EnvironmentGroup;
}

export const apiService = (deps: ApiDependencies): WebService =>
  acme.web("api", {
    runtime: "node",
    buildCommand: "pnpm build",
    startCommand: "pnpm start",
    healthCheckPath: "/healthz",                              // typed `/${string}`
    scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
    previews: { plan: "starter" },
    envGroups: [deps.settings],                               // -> - fromGroup: shared-settings
    env: (self) => ({
      DATABASE_URL: deps.db.connectionString,                 // -> fromDatabase {main-db, connectionString}
      REDIS_URL: deps.cache.connectionString,                 // -> fromService {cache, keyvalue, connectionString}
      STRIPE_KEY: secret(),                                   // -> sync: false
      APP_HOST: self.renderVar("RENDER_EXTERNAL_HOSTNAME"),   // -> fromService {api, web, envVarKey}
    }),
  });
```

```ts
// render.ts (repo root)
import { blueprint, external, generated, readReplica } from "render-blueprint";
import { acme } from "./infra/defaults.ts";
import { apiService } from "./apps/api/render.ts";

const replica = readReplica("main-db-replica");
const db      = acme.postgres("main-db", { postgresMajorVersion: "16", readReplicas: [replica] });
const cache   = acme.keyValue("cache", { ipAllowList: [], maxmemoryPolicy: "allkeys-lru" });
const settings = acme.envGroup("shared-settings", { env: { LOG_LEVEL: "info", SESSION_SECRET: generated() } });
const api     = apiService({ db, cache, settings });

const jobs = acme.worker("jobs", {
  runtime: "docker",
  dockerfilePath: "./Dockerfile.jobs",
  env: {
    API_URL: api.hostport,                                    // fromService {api, web, hostport}
    AUTH_HOST: external.privateService("legacy-auth").host,   // in the workspace, not in this blueprint
  },
});

const nightly = acme.cron("nightly-report", { runtime: "node", schedule: "0 2 * * *", startCommand: "pnpm report" });

const site = acme.staticSite("web", {
  buildCommand: "pnpm build",
  staticPublishPath: "./dist",
  routes:  [{ type: "rewrite", source: "/*", destination: "/index.html" }],
  headers: [{ path: "/*", name: "X-Frame-Options", value: "DENY" }],
});

export default blueprint({
  previews: { generation: "automatic", expireAfterDays: 7 },
  resources: [db, cache, settings, api, jobs, nightly, site],
});
```

`replica` is not in `resources` — `ReadReplica` is outside `BlueprintResource`, so listing it is a
type error, while `replica.connectionString` stays available to any service.

CLI (`render-blueprint`; config discovered as `render.ts`, walking up from cwd; `--file` overrides):

```console
$ render-blueprint synth
render.yaml written (7 resources, 1 read replica)
warning  nightly-report: runtime `node` with no buildCommand; Render's prose calls it required
warning  api: STRIPE_KEY uses secret(); sync:false values are not copied into preview environments
         (spec §6.3). Consider a Dashboard-managed group via external.envGroup(...).

$ render-blueprint check           # CI: 0 = up to date, 2 = drift, 1 = invalid
render.yaml is up to date.
$ render-blueprint check --strict  # warnings become exit 1
```

```ts
const report = await checkForDrift(config, { path: "render.yaml" });
process.exitCode = report.match({
  ok: (drift) => (drift.status === "clean" ? 0 : 2),
  err: (error) => { console.error(formatIssues(error)); return 1; },
});
```

## 4. What it hides

YAML serialization entirely: quoting, indentation, key order, the `# generated — do not edit` header.
The four disjoint schema branches and the `(type, runtime)` discriminator — the factory you called
picks the branch. The `envVars` list/map conversion and the keyless `fromGroup` entry. That
`fromService.type` is a *wider* enum than a service's own `type` (`static`, `keyvalue`). Which of the
five env-var forms a value becomes. The `previewPlan`/`previews.plan` split. That Postgres lives in
`databases` and Key Value in `services`. Read-replica name registration. Placement bookkeeping across
root / environments / `ungrouped`. Drift normalization for `--check`. Every deprecated field (`env`,
`autoDeploy`, `previewsEnabled`, `previewsExpireAfterDays`, `pullRequestPreviewsEnabled`, service
`previewPlan`, `type: redis`, `afterFirstDeployCommand`, singular `domain`) has no TS spelling at
all, so the current form is the only reachable output.

It deliberately does **not** hide Render's defaults: the emitter writes exactly what the author wrote
and never injects a default, because omission means "retain current" on an existing resource and
"apply the default" on a new one (spec §12) — inventing values would silently rewrite adopted
resources.

## 5. Mistake matrix

| # | Authoring mistake | Caught by | Mechanism |
| --- | --- | --- | --- |
| 1 | `cache.hostport` (wrong property for a Key Value ref) | **Compile** | not a member of `KeyValueReference` |
| 2 | `db.hostport` / `db.envVar("X")`; `jobs.host` on a worker | **Compile** | not members of `PostgresReference` / `OpaqueServiceReference` |
| 3 | `disk` on a cron job | **Compile** | `CronConfig` has no `disk` field (spec §4.8) |
| 4 | `plan` or `region` on a static site | **Compile** | `StaticSiteConfig` omits both |
| 5 | Cron with no `schedule`; Key Value with no `ipAllowList` | **Compile** | required fields |
| 6 | `secret()` inside an env group | **Compile** | `EnvGroupValue` excludes `SecretValue` (spec §10) |
| 7 | Both `value` and `generateValue` on one var | **Compile** | `literal()` / `generated()` are disjoint `EnvValue` members — unrepresentable |
| 8 | `fromService` with both `property` and `envVarKey` | **Synth** | unrepresentable through the API: a handle yields one or the other, and nothing builds the pair. An object literal annotated `ServiceReferenceValue` is *not* rejected, because TypeScript admits any property a union member declares, so the two strict branches of the value schema are what reject it (ADR-0001) |
| 9 | Typo `RENDER_EXTERNAL_HOSTNAM` | **Compile** | `renderVar` takes the closed `RenderProvidedKey` union |
| 10 | `healthCheckPath: "healthz"` | **Compile** | typed `` `/${string}` `` |
| 11 | `runtime: "static"` on a worker; `plan: "free"` on worker/pserv | **Compile** | `WorkerRuntime` excludes `static`; `WorkerPlan = Exclude<ServerPlan, "free">` — both stricter than the schema, per prose |
| 12 | `repo` alongside `runtime: "image"` | **Compile\*** | `runtime` discriminates the source union + excess-property check. *\*escapes if the config is a pre-built variable → synth `ConflictingSource`* |
| 13 | Listing a `readReplica`, or `external.privateService("x")`, in `resources` | **Compile** | outside `BlueprintResource`; external handles carry no `kind` |
| 14 | Dangling ref: `db.connectionString` used, `db` never listed | **Synth** | `DanglingReference` — names the source resource, the env key, the missing target |
| 15 | Two resources named `api` | **Synth** | `DuplicateResourceName`, global scope (spec §16 A is ambiguous; we take the strict reading) |
| 16 | Same resource at root **and** in a project environment | **Synth** | `ResourceInMultipleLocations`, by object identity — possible only because resources are inert values |
| 17 | `scaling: {minInstances: 3, maxInstances: 1}`; no target metric; `scaling` + `disk` | **Synth** | `ScalingRangeInverted` / `ScalingTargetMissing` / `DiskPreventsScaling` |
| 18 | `targetCPUPercent: 95`; `diskSizeGB: 7`; 6 read replicas; `disk.mountPath: "/etc"` | **Synth** | numeric-range and forbidden-value rules are synth-time by policy |
| 19 | `api.envVar("TPYO")` where in-blueprint `api` declares no such key | **Synth** | `UnknownServiceEnvVarKey` |
| 20 | `highAvailability` with `postgresMajorVersion: "12"` | **Synth** | `HighAvailabilityUnsupported` (needs PG ≥ 13) |
| 21 | Referencing a service declared in another file | **Compile** if never imported (no binding); **Synth** `DanglingReference` if imported but unlisted |
| 22 | Declaring a resource, never referencing it, never listing it | **Not caught by the library** — lint only, see §8 |
| 23 | `secret()` with root previews on; `branch` set with root previews on; `ipAllowList` on worker/pserv | **Synth warning** | spec §6.3, §11, §16 F |
| 24 | Bad `repo`/`branch`; external ref that exists nowhere; plan gating (autoscaling needs Pro); `maintenanceMode.uri` self-pointing | **Passes through** | to Render sync / `render blueprints validate` |

Policy line: **structural, enum and presence rules are compile-time; relational, numeric-range and
cross-resource rules are synth-time; anything needing workspace state passes through.**

## 6. Preview and environment overrides

**No context argument.** `ctx.isPreview` is a Railway idiom that does not transfer: Render evaluates
one committed `render.yaml` and applies the preview overrides itself, so a context arg would make
synth non-deterministic and produce a file that is wrong for one of the two modes. Preview
differences are declared as data, in the fields Render already provides.

```ts
blueprint({ previews: { generation: "automatic", expireAfterDays: 7 }, resources: [...] });  // root (spec §1.1)

acme.web("api",        { previews: { generation: "automatic", plan: "starter", instances: 2 } });
acme.staticSite("web", { previews: { generation: "automatic" } });               // generation only
acme.keyValue("cache", { previews: { plan: "starter" } });                       // -> previewPlan
acme.postgres("main-db", { previews: { plan: "basic-1gb", diskSizeGB: 5 } });    // -> previewPlan/previewDiskSizeGB
env: { LOG_LEVEL: literal("info", { previewValue: "debug" }) }                   // per-variable
```

Cron jobs and env groups have no `previews` field (spec §4.8), so it is absent from their configs.
`projects[].environments[]` is the other axis, and it is explicit rather than implicit:

```ts
blueprint({ projects: [project("acme", { environments: [
  environment("production", { resources: [db, api], networking: { isolation: "enabled" }, permissions: { protection: "enabled" } }),
]})]});
```

Because resource values are inert, the same `db` object appearing in two environments is caught by
identity (mistake 16), not by comparing name strings.

## 7. Escape hatch

```ts
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
export interface JsonObject { readonly [key: string]: JsonValue }

readonly extraFields?: JsonObject;              // on every resource config and on blueprint()
readonly extraEnvVars?: readonly JsonObject[];  // for a future sixth env-var form
```

`extraFields` is shallow-merged into that resource's emitted mapping (or the root document) after the
modeled fields. Merging over a key the library already emitted is a synth-time `ExtraFieldConflict`,
not a silent override — the hatch adds, it never rewrites. No `unknown`, no `object`, no
`Record<string, unknown>`, no assertion: `JsonValue` is a concrete recursive union, so the anti-slop
dictionary rule holds. There is no post-synth document transform, because `--check` needs synth to be
a pure function of the config value.

## 8. Trade-offs

**Name duplication (`const api = web("api", …)`) is accepted, not solved.** The alternative that
removes it — records keyed by name, survey sketch (a) — makes cross-file composition impossible
without losing the key-based checking, and cross-file composition is a hard requirement here. The
mitigation is two-part and modest: (i) the emitted name is *only ever* the string argument, so the
binding is cosmetic and a mismatch is never a correctness bug; (ii) a shipped oxlint rule
`render-blueprint/binding-matches-name` warns when the binding is not a case-variant of the string,
**off by default**, because Render names may legitimately contain spaces and match no identifier
(spec §16 A). INFERRED: no type-level trick recovers the binding name. That is the whole answer.

**The forgotten resource is only partly solved.** Three cases. *Declared, referenced, not listed* —
a hard synth error with a precise message (mistake 14); this is the overwhelmingly common case.
*Declared in a leaf file, exported, never assembled* — mitigated structurally by the
dependencies-function pattern in §3: a leaf exports **one** callable, so the root's forgetting surface
is one item per file rather than N; `group("api", [db, api])` collapses co-located resources the same
way. *Declared, never referenced, never listed* (a lone worker) — **not detectable at runtime**
without a construction-time global registry, and a registry is exactly the implicit-side-effect design
this shape rejects. The only real answer is static: a shipped oxlint rule
`render-blueprint/no-unregistered-resource` flagging a factory call whose result is neither exported
nor passed to `resources` / `group` / `environment`. INFERRED, and a lint is defeatable.

Other costs, stated plainly:

- **A large export surface** — eight factories, nine `external` members, four value helpers, three
  synth functions — against sketch (a)'s single `defineBlueprint`.
- **`isolatedDeclarations` taxes cross-file composition.** `export const api = web("api", …)` needs
  `: WebService`. That is why resource types are non-generic and hand-writable — and why read replicas
  use a `readReplica()` value rather than a `PostgresDatabase<"main-db-replica">` phantom, which would
  have been more precise and unwritable by hand.
- **The `env` map-or-function union is a wart**: two spellings for one field, needed only for
  self-reference. A global `self` sentinel would be uniform but would lose the per-kind typing that
  makes `self.host` on a worker a compile error, so the wart is the cheaper cost.
- **Being stricter than the JSON Schema will occasionally block a legal blueprint** (`healthCheckPath`
  on a worker, `free` on a private service). `extraFields` is the release valve, which means a
  determined escape bypasses the very rule that was the point.
- **Uniform `previews` breaks the 1:1 read of the YAML** for Postgres and Key Value, and **a map for
  `env` loses duplicate-key detection** when a spread shadows an earlier key — the YAML list form
  would have surfaced it.

## 9. Open decisions for the implementer

1. Whether to bundle Render's published JSON Schema as a belt-and-braces check on the emitted
   document, and whether `check` shells out to `render blueprints validate` when the CLI (v2.7.0+) is
   on PATH.
2. Emission order of `fromGroup` entries relative to explicit `env` entries — Render documents no
   precedence (spec §16 L). Any choice must be deterministic; the proposal is explicit vars first.
3. Whether `KeyValueReference.host`/`.port` survive: the schema permits them on `fromService`, the
   prose documents only `connectionString` for Key Value (spec §6.2). Dropping them is safer.
4. Whether to expose `fromService` with `type: "dpg"` / `"job"` (spec §16 D, both undocumented), and
   whether to emit the undocumented root `version: "1"` (currently only via `extraFields`).
5. Whether `buildFilter`'s replace-destructive sync semantics (spec §12) deserve a warning whenever
   the field is absent — the library has no baseline except in `check` mode.
6. Whether `withDefaults` conflicts are last-wins (proposed) or an error.
7. Whether to model `ungrouped` at all, given that using it *removes* a resource from its current
   environment — arguably too destructive to be one keyword away.
8. Whether name uniqueness is global or per kind (spec §16 A is genuinely ambiguous; the proposal
   takes the strict global reading), and whether to warn on names containing spaces, which are legal
   per Render's own examples but whose `name` → hostname transformation is undocumented.
9. Whether an opt-in mode that auto-includes transitively referenced resources should exist. It would
   eliminate mistake 14 entirely, at the cost of making `resources` non-authoritative.
