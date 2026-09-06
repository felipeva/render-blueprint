# Design C — immutable type-state builders

## 1. Design thesis

The `(type, runtime)` pair is a *state machine*, not a config flag: §0 says the schema models four disjoint
shapes with `additionalProperties: false`, so a wrong field is a category error, not a bad value. This design
puts that state in the builder's type parameter, so the method list *is* the §4.8 availability matrix —
`.disk()` does not exist on a cron job, `.plan()` does not exist on a static site — and autocomplete becomes
the documentation. Everything the type system can decide is decided before synth runs; `Result` is reserved
for the value-dependent rules (min ≤ max, dangling names) no reasonable type can express.

## 2. Interface signature

### 2.1 The state-tracking technique

Three pieces: a **phantom stage record** as a type parameter, **capability interfaces intersected under a
conditional**, and a **readiness brand** that gates admission to the blueprint.

```ts
// ---- 1. an "absent" type to intersect with (never `{}` — anti-slop rule 13) ----
export type NoMethods = Record<never, never>;
export type When<Actual extends string, Expected extends string, Methods> =
  Actual extends Expected ? Methods : NoMethods;

// ---- 2. the phantom stage records: two or three slots, no more ----
export type RuntimeFamily = "unset" | "native" | "docker" | "image";
/** `open` → nothing chosen; the other three are mutually exclusive per §4.4/§4.5. */
export type ScaleSlot = "open" | "fixed" | "auto" | "disk";

export interface ServerStage { runtime: RuntimeFamily; started: boolean; scale: ScaleSlot }
export interface CronStage { runtime: RuntimeFamily; started: boolean; scheduled: boolean }
export interface StaticStage { published: boolean }
export interface KeyValueStage { allowListed: boolean }

// ---- 3. the readiness brand ----
declare const READY: unique symbol;
export interface Ready<Kind extends ResourceKind, Name extends string> {
  readonly [READY]: Kind;
  readonly name: Name;
}
/** Same key, different literal → the assignment error *prints the reason*. */
export interface Blocked<Reason extends string> { readonly [READY]: Reason }

export type ServerReady<S extends ServerStage> =
  S["runtime"] extends "unset" ? false : S["runtime"] extends "native" ? S["started"] : true;
export type CronReady<S extends CronStage> =
  ServerReady<S> extends true ? S["scheduled"] : false;
```

`blueprint({ resources })` takes `readonly PlacedResource[]` where
`PlacedResource = Ready<ResourceKind, string>`. A cron job that never called `.schedule()` resolves to
`Blocked<"cron job needs .schedule(...) before it can be added to a blueprint">`, and TypeScript reports:

```
Type '"cron job needs .schedule(...) before it can be added to a blueprint"'
  is not assignable to type 'ResourceKind'.
```

### 2.2 Per-kind capability sets (derived directly from §4.8)

```ts
export type WebBuilder<Name extends string, S extends ServerStage> =
  & ServerCore<"web", Name, S>   // region plan(serverPlan) env envFrom buildFilter autoDeploy preDeploy
                                 //   initialDeployHook maxShutdownDelaySeconds previews with extra ref
  & WebFacing<Name, S>           // healthCheck domains renderSubdomainPolicy maintenanceMode
                                 //   ipAllowList — prose says web-only, schema is looser (§4.8 ⚠)
  & When<S["runtime"], "unset",  RuntimeChoice<"web", Name, S>>
  & When<S["runtime"], "native", NativeSource<"web", Name, S>>   // .repo .build .start
  & When<S["runtime"], "docker", DockerSource<"web", Name, S>>   // .repo .dockerfile .dockerCommand
                                                                 //   .registryCredential
  & When<S["runtime"], "image",  ImageSource<"web", Name, S>>    // .dockerCommand only
  & When<S["scale"],   "open",   ScaleChoice<"web", Name, S>>    // .disk .instances .autoscale
  & (ServerReady<S> extends true ? Ready<"web", Name>
      : Blocked<"unfinished web service: pick a runtime, and call .start(...) for native runtimes">);

export type WorkerBuilder<Name extends string, S extends ServerStage>   // = WebBuilder minus WebFacing
export type PrivateServiceBuilder<Name extends string, S extends ServerStage>  // web-facing minus domains

export type CronBuilder<Name extends string, S extends CronStage> =
  & CronCore<Name, S>                     // plan(cronPlan!) region env buildFilter autoDeploy preDeploy
  & ScheduleMethod<Name, S>               // .schedule(expr)
  & When<S["runtime"], "unset",  RuntimeChoice<"cron", Name, S>>
  & When<S["runtime"], "native", NativeSource<"cron", Name, S>>
  & When<S["runtime"], "docker", DockerSource<"cron", Name, S>>
  & When<S["runtime"], "image",  ImageSource<"cron", Name, S>>
  & CronDenied                            // poison members, see below
  & (CronReady<S> extends true ? Ready<"cron", Name>
      : Blocked<"cron job needs .schedule(...) and a start command before it can be added">);

export type StaticBuilder<Name extends string, S extends StaticStage> =
  & StaticCore<Name, S>   // repo build preDeploy publish routes headers domains renderSubdomainPolicy
                          //   ipAllowList buildFilter autoDeploy env envFrom previews({generation}) extra
  & StaticDenied          // poison members for plan/region/start/disk/scaling/healthCheck
  & (S["published"] extends true ? Ready<"static", Name>
      : Blocked<"static site needs .publish(\"./dist\") before it can be added">);

export type KeyValueBuilder<Name extends string, S extends KeyValueStage> =
  & KeyValueCore<Name, S>                 // plan(keyValuePlan!) region maxmemoryPolicy persistence
                                          //   previewPlan ipAllowList with extra ref
  & (S["allowListed"] extends true ? Ready<"keyvalue", Name>
      : Blocked<"Key Value needs .ipAllowList([...]) — pass [] to block all external traffic">);

export type PostgresBuilder<Name extends string, Replicas extends string> =
  & PostgresCore<Name, Replicas>   // plan(postgresPlan!) region databaseName user postgresVersion
                                   //   diskSizeGB storageAutoscaling connectionPool ipAllowList
                                   //   highAvailability previewPlan previewDiskSizeGB with extra
  & { readReplicas<const R extends readonly string[]>(...names: R): PostgresBuilder<Name, R[number]> }
  & Ready<"database", Name>;              // a database needs nothing but a name

export type EnvGroupBuilder<Name extends string> =
  & { vars(values: GroupVars): EnvGroupBuilder<Name>; readonly ref: EnvGroupRef<Name> }
  & Ready<"envVarGroup", Name>;
```

**Why "no `.disk()` on cron" is typed two ways.** `CronCore` never declares `disk`, so it is *absent* — the
cleanest state. But `Property 'disk' does not exist on type 'CronCore<…> & ScheduleMethod<…> & …'` prints an
unreadable intersection, so for the eight highest-traffic mistakes we add a *poison member* instead:

```ts
export interface CronDenied {
  /** @deprecated Cron jobs have no `disk` field (schema: `cronService`). */
  readonly disk: (denied: "cron jobs cannot have a disk") => never;
  /** @deprecated Cron jobs cannot scale. */
  readonly autoscale: (denied: "cron jobs cannot autoscale") => never;
  /** @deprecated Cron jobs have no health check. */
  readonly healthCheck: (denied: "cron jobs have no healthCheckPath") => never;
}
```

`.disk({ name: "d", mountPath: "/data" })` now errors with
`Argument of type '{ name: string; mountPath: string; }' is not assignable to parameter of type
'"cron jobs cannot have a disk"'` — the diagnostic carries the explanation. `@deprecated` makes editors
strike the member through and rank it last in autocomplete, so the poison does not pollute discovery.

### 2.3 Reference values

Refs are inert data hanging off every builder (`.ref`), available from stage zero because the name is known
at the factory call. The property set is the §6.2 enum *for that kind* — a keyvalue ref genuinely has no
`.host`.

```ts
export interface ServerServiceRef<Name extends string, T extends "web" | "pserv"> {
  readonly host: EnvFromService<Name, T>;      // → fromService {name, type, property: host}
  readonly port: EnvFromService<Name, T>; readonly hostport: EnvFromService<Name, T>;
  renderVar(key: RenderProvidedVar): EnvFromService<Name, T>;  // closed enum, §6.6
  envVar(key: string): EnvFromService<Name, T>;                // open escape
}
/** worker / cron / static: §6.2 gives them no host/port/hostport/connectionString. */
export interface OpaqueServiceRef<Name extends string, T extends ServiceRefType> {
  renderVar(key: RenderProvidedVar): EnvFromService<Name, T>;
  envVar(key: string): EnvFromService<Name, T>;
}
export interface KeyValueRef<Name extends string> {
  readonly connectionString: EnvFromService<Name, "keyvalue">; // §6.2: the *only* legal property
}
export interface PostgresRef<Name extends string, Replicas extends string> {
  // one `EnvFromDatabase<Name>` property per `databaseEnvVarProperty` value (§6.2):
  readonly connectionString: EnvFromDatabase<Name>; readonly connectionPoolString: EnvFromDatabase<Name>;
  readonly host: EnvFromDatabase<Name>; readonly port: EnvFromDatabase<Name>;
  readonly user: EnvFromDatabase<Name>; readonly password: EnvFromDatabase<Name>;
  readonly database: EnvFromDatabase<Name>;
  replica<R extends Replicas>(name: R): PostgresRef<R, never>;   // §9: replicas are named targets
}
/** The 16 Render-provided defaults from §6.6, as a closed union. */
export type RenderProvidedVar = "RENDER_EXTERNAL_HOSTNAME" | "RENDER_EXTERNAL_URL" | "PORT" /* … */;

// §12: a reference may point outside the blueprint. That must be *said*, not defaulted.
export interface ExternalRefs {
  webService<N extends string>(name: N): ServerServiceRef<N, "web">;
  privateService<N extends string>(name: N): ServerServiceRef<N, "pserv">;
  worker<N extends string>(name: N): OpaqueServiceRef<N, "worker">;
  keyValue<N extends string>(name: N): KeyValueRef<N>;
  postgres<N extends string>(name: N): PostgresRef<N, never>;
  envGroup<N extends string>(name: N): EnvGroupRef<N>;
}
export declare const external: ExternalRefs;

// Env-var values. The five §6.1 shapes are five disjoint constructors, so they cannot be combined.
export type EnvValue =
  | string | number                       // shorthand for literal(...)
  | LiteralValue | SecretValue | GeneratedValue
  | EnvFromDatabase<string> | EnvFromService<string, ServiceRefType>;
export type EnvVars = { readonly [key: string]: EnvValue };
export type GroupValue = string | number | LiteralValue | GeneratedValue;   // §10: no secret, no fromX
export type GroupVars = { readonly [key: string]: GroupValue };

export declare function literal(value: string | number, options?: LiteralOptions): LiteralValue;
export declare function secret(): SecretValue;      // → sync: false
export declare function generated(): GeneratedValue; // → generateValue: true
```

### 2.4 Root and outputs

```ts
export type PlacedResource = Ready<ResourceKind, string>;
export interface BlueprintInput {
  readonly previews?: { readonly generation?: PreviewsGeneration; readonly expireAfterDays?: number };
  readonly resources?: readonly PlacedResource[];
  readonly projects?: readonly PlacedProject[];
  readonly ungrouped?: readonly PlacedResource[];
  readonly extra?: ExtraFields;
}
export declare function blueprint(input: BlueprintInput): Blueprint;
export declare function project<N extends string>(name: N): ProjectBuilder<N, false>;

export interface SynthOutput { readonly yaml: string; readonly warnings: readonly BlueprintWarning[] }
export interface CheckOutcome { readonly status: "clean" | "drift"; readonly diff: string }

export declare function synth(bp: Blueprint): Result<SynthOutput, ValidationFailed | EmitFailed>;
export declare function writeBlueprint(
  bp: Blueprint, path: string,
): Promise<Result<SynthOutput, ValidationFailed | EmitFailed | FileWriteFailed>>;
export declare function checkBlueprint(
  bp: Blueprint, path: string,
): Promise<Result<CheckOutcome, ValidationFailed | EmitFailed | FileReadFailed>>;

export class DuplicateResourceName extends TaggedError("DuplicateResourceName")<{
  readonly message: string; readonly name: string; readonly kinds: readonly ResourceKind[] }> {}
export class ReferencedResourceNotPlaced extends TaggedError("ReferencedResourceNotPlaced")<{
  readonly message: string; readonly referenced: string; readonly from: string;
  readonly envVarKey: string }> {}
// …same pattern for ResourcePlacedTwice {name, locations}, InvalidFieldValue {resource, field, reason},
// ExtraFieldConflict {resource, field}, DeprecatedFieldRejected {resource, field, replacement},
// and EmitFailed / FileWriteFailed / FileReadFailed {path, cause}.
export type BlueprintIssue =
  | DuplicateResourceName | ReferencedResourceNotPlaced | ResourcePlacedTwice
  | InvalidFieldValue | ExtraFieldConflict | DeprecatedFieldRejected;
/** All issues are collected (survey §3), never thrown one at a time. */
export class ValidationFailed extends TaggedError("ValidationFailed")<{
  readonly message: string; readonly issues: readonly BlueprintIssue[] }> {}
```

Drift is an *expected outcome a caller acts on*, so it lives in the `Ok` channel; the CLI maps
`clean → 0`, `drift → 2`, `Err → 1` (Terraform `--detailed-exit-code` semantics, survey §3).

## 3. Usage example — the canonical scenario

`infra/data.ts` — datastores and the shared group:

```ts
import { postgres, keyValue, envGroup, generated } from "render-blueprint";
import type { PostgresBuilder, KeyValueBuilder, EnvGroupBuilder } from "render-blueprint";

export const mainDb: PostgresBuilder<"main-db", "main-db-replica"> = postgres("main-db")
  .plan("basic-1gb")
  .region("oregon")
  .postgresVersion("16")              // emits the string "16", never the number
  .readReplicas("main-db-replica");

export const cache: KeyValueBuilder<"cache", { allowListed: true }> = keyValue("cache")
  .plan("free")
  .ipAllowList([])                    // [] = block all external traffic (§7)
  .maxmemoryPolicy("allkeys-lru");

export const sharedSettings: EnvGroupBuilder<"shared-settings"> = envGroup("shared-settings")
  .vars({ LOG_LEVEL: "info", SESSION_SECRET: generated() });
```

`apps/api/render.ts` — declared here, assembled elsewhere:

```ts
import { web, secret } from "render-blueprint";
import type { WebBuilder } from "render-blueprint";
import { mainDb, cache, sharedSettings } from "../../infra/data.ts";

type ApiStage = { runtime: "native"; started: true; scale: "auto" };

export const api: WebBuilder<"api", ApiStage> = web("api")
  .node()
  .repo("https://github.com/acme/api", { branch: "main" })
  .build("pnpm build")
  .start("pnpm start")
  .healthCheck("/healthz")            // param type is `/${string}` — leading slash is compile-checked
  .autoscale({ min: 1, max: 3, targetCPUPercent: 70 })
  .previews({ plan: "starter" })
  .envFrom(sharedSettings)            // → { fromGroup: shared-settings }
  .env((self) => ({                   // callback form: the only way to self-reference (§6.6)
    DATABASE_URL: mainDb.ref.connectionString,
    REDIS_URL: cache.ref.connectionString,
    STRIPE_KEY: secret(),
    APP_HOST: self.renderVar("RENDER_EXTERNAL_HOSTNAME"),
  }));
```

`render.ts` at the repo root:

```ts
import { blueprint, worker, cron, staticSite, external, writeBlueprint, checkBlueprint }
  from "render-blueprint";
import { api } from "./apps/api/render.ts";
import { mainDb, cache, sharedSettings } from "./infra/data.ts";

const jobs = worker("jobs")
  .docker()                                   // .build()/.start() are now gone; .dockerfile() appeared
  .dockerfile("./Dockerfile.jobs")
  .env({
    API_URL: api.ref.hostport,
    AUTH_HOST: external.privateService("legacy-auth").host,   // never in this blueprint, on purpose
  });

const nightlyReport = cron("nightly-report")
  .node()
  .schedule("0 2 * * *")
  .start("pnpm report");

const site = staticSite("web")                // no runtime selector: staticService is runtime: static
  .build("pnpm build")
  .publish("./dist")
  .routes([{ type: "rewrite", source: "/*", destination: "/index.html" }])
  .headers([{ path: "/*", name: "X-Frame-Options", value: "DENY" }]);

export const acme: Blueprint = blueprint({
  previews: { generation: "automatic", expireAfterDays: 7 },
  resources: [mainDb, cache, sharedSettings, api, jobs, nightlyReport, site],
});

const outcome = process.argv.includes("--check")
  ? await checkBlueprint(acme, "render.yaml")
  : await writeBlueprint(acme, "render.yaml");

process.exitCode = outcome.match({
  ok: (value) => ("status" in value && value.status === "drift" ? 2 : 0),
  err: (error) => { report(error); return 1; },
});
```

## 4. What it hides

The four disjoint schema shapes and which root list each resource belongs to (Postgres → `databases`, Key
Value → `services`); the `type:` and `runtime:` strings entirely; the `fromService.type` value, derived from
the referenced builder's kind; the env-var map → list-of-objects conversion and which of the six object
shapes each value becomes; the four plan enums (`serverPlan` / `cronPlan` / `keyValuePlan` / `postgresPlan`
are one `.plan()` each, resolved per kind); that `postgresMajorVersion` must be a quoted string; YAML
emission, key order, quoting and the generated-file header; the deprecated→current mapping (`autoDeploy` →
`autoDeployTrigger`, `previewsEnabled` → `previews.generation`, `redis` → `keyvalue`, `env` → `runtime`,
`previewPlan` → `previews.plan` on servers but *not* on Key Value/Postgres, where flat `previewPlan` is
current); the §0.2 `serverService`/`staticService` `anyOf` ambiguity, unreachable because a static builder
has no `plan`; and the structural sharing that makes every chain step a cheap new value.

Two things it deliberately *surfaces*, as synth warnings: omitting `buildFilter` wipes an existing service's
filters (§12), and a native runtime with no build command (prose calls it required, the schema does not — so
it cannot be a hard gate without breaking the canonical `nightly-report` cron).

## 5. Mistake matrix

| # | Authoring mistake | Caught at | Mechanism |
|---|---|---|---|
| 1 | `.disk()` on a cron job | **compile** | `CronDenied` poison member: parameter type is the message string |
| 2 | `.plan("free")` on a static site | **compile** | `StaticDenied` poison member; `StaticCore` has no `plan` |
| 3 | `cache.ref.host` (wrong property for a Key Value ref) | **compile** | `KeyValueRef` declares only `connectionString` (§6.2) |
| 4 | Cron added without `.schedule()` | **compile** | `Blocked<"cron job needs .schedule(...)">` fails assignment to `PlacedResource` |
| 5 | Key Value added without `.ipAllowList()` | **compile** | same brand, reason `"pass [] to block all external traffic"` |
| 6 | `secret()` inside an env group | **compile** | `GroupVars`' value type `GroupValue` excludes `SecretValue` (§10) |
| 7 | Both `value` and `generateValue` on one var | **compile** | `literal()` / `generated()` return disjoint nominal types; no field to co-set |
| 8 | `fromService` with both `property` and `envVarKey` | **compile** | `.host` and `.envVar(k)` are different members returning one finished value |
| 9 | `.build()` on a `docker` runtime, or `.repo()` after `.image("…")` | **compile** | only the matching `*Source` interface is intersected; `.image(url)` consumes the URL so there is no second source |
| 10 | Native web service with no `.start()` | **compile** | `ServerReady<S>` is `false` → `Blocked<…>` at `blueprint()` |
| 11 | `healthCheck("healthz")` (no leading slash) | **compile** | parameter type is the template literal `` `/${string}` `` |
| 12 | Typo `RENDER_EXTERNAL_HOSTNAM` | **compile** | `.renderVar()` takes the closed `RenderProvidedVar` union; `.envVar()` is the opt-out |
| 13 | `.instances(3)` on a service with a `.disk()` | **compile** | `scale` slot moved to `"disk"`; `ScaleChoice` is no longer intersected (§4.4) |
| 14 | Duplicate resource name | **compile** *(literal names)* / **synth** | `Ready<Kind, Name>` carries the literal; `blueprint()` runs a `DuplicateNames<T>` conditional. Falls back to a `DuplicateResourceName` issue when a name is a computed `string` |
| 15 | Referencing a built resource left out of `resources` — including one declared in `apps/api/render.ts` and never imported at the root | **synth** | refs from `.ref` carry an "expected in this blueprint" brand → `ReferencedResourceNotPlaced`. Resources are inert values, so a missing import is simply a missing array entry |
| 16 | Referencing `external.privateService("legacy-auth")` that does not exist in the workspace | **passes through to Render** | §12: out-of-blueprint refs are legal and unverifiable offline; the blueprint fails to sync |
| 17 | `.autoscale({ min: 3, max: 1 })` | **synth** | numeric literals cannot be compared without recursive tuple arithmetic → `InvalidFieldValue` |
| 18 | `.diskSizeGB(7)` on Postgres (must be 1 or a multiple of 5) | **compile** | parameter is the literal union `1 \| 5 \| 10 \| … \| 1000`; larger values go through `.extra()` |
| 19 | Same resource placed in both `resources` and a project environment | **synth** | `ResourcePlacedTwice` (§1's "exactly one location" rule) |
| 20 | `.extra({ env: "node" })` — a deprecated field | **synth** | `DeprecatedFieldRejected` with `replacement: "runtime"`; §13's list is a denylist on `extra` keys |
| 21 | Forgetting to reassign the result of a chain step | **not caught** | TypeScript has no `#[must_use]`; see trade-offs |

## 6. Preview and environment overrides

Overrides are methods on the resource they belong to, shaped exactly like §4.6/§11 — services get the nested
object, datastores get the flat field, and cron jobs get neither because they have neither.

```ts
web("api").previews({ generation: "automatic", plan: "starter", instances: 1 })  // servicePreviews
staticSite("web").previews({ generation: "automatic" })                          // staticServicePreviews
keyValue("cache").previewPlan("free")                                            // flat, current form
postgres("main-db").previewPlan("free").previewDiskSizeGB(5)                      // flat, current form
web("api").env({ LOG_LEVEL: literal("info", { preview: "debug" }) })              // → previewValue
```

`secret()` takes no preview option at all: §6.3 says `sync: false` values are never copied into previews, so
the option would be a lie. The documented workaround (a Dashboard-managed group) is
`.envFrom(external.envGroup("preview-secrets"))`.

Projects and environments are a second placement site with the same `Ready` gate:

```ts
blueprint({
  previews: { generation: "automatic", expireAfterDays: 7 },
  projects: [
    project("acme")
      .environment("production", {
        resources: [mainDb, api],
        networking: { isolation: "enabled" },
        permissions: { protection: "enabled" },
      })
      .environment("staging", { resources: [stagingDb, stagingApi] }),
  ],
});
```

`project(...)` is itself type-state: `ProjectBuilder<N, false>` is `Blocked<"a project needs at least one
environment">` until `.environment()` is called once (§2's prose rule, which the schema does not encode).

## 7. Escape hatch

Every builder ends with `.extra(fields)`, merged into that resource's emitted mapping. The value type is a
closed JSON union — never `unknown`, never `Record<string, unknown>`:

```ts
export type JsonValue =
  | string | number | boolean | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type ExtraFields = { readonly [field: string]: JsonValue };

web("api").extra({ someNewRenderField: { nested: true } });
blueprint({ resources: [...], extra: { version: "1" } });   // root-level passthrough
```

Three rules keep it from becoming a second, worse API: a key that a modeled method also owns is an
`ExtraFieldConflict` at synth (no silent last-wins); a key on §13's deprecated list is a
`DeprecatedFieldRejected`; and there is no post-synth text transform, because a string-level hook would make
the emitter untestable and would let `render.yaml` drift from the type model.

## 8. Trade-offs

**Type complexity and error quality.** A `WebBuilder` is a seven-way intersection of conditional types. Hover
text is long, and a plain missing method reports `Property 'x' does not exist on type 'ServerCore<"web",
"api", { runtime: "docker"; … }> & WebFacing<…> & …'`. Poison members fix the eight worst cases and
`Blocked<Reason>` fixes readiness, but the long tail of absent methods still produces intersection soup.
Largest real cost; it lands on beginners hardest.

**`isolatedDeclarations` friction.** Every exported symbol needs an explicit annotation, and a half-built
builder's is the full stage record: `WebBuilder<"api", { runtime: "native"; started: true; scale: "auto" }>`.
Nameable and writable — the editor's hover text is exactly what you paste — but noisy, and it churns whenever
the chain changes. The design's answer: make the *finished* resource the unit of cross-file composition (a
one-line local `type ApiStage` alias, as in §3) and share defaults as plain option objects, never as
half-built builders.

**Method-count explosion.** A server builder carries roughly 30 methods plus 8 runtime selectors. Mitigated
by keeping the stage record to two or three slots and by shipping `.with(defaults)`:

```ts
export const acmeDefaults: ServerDefaults = {
  region: "oregon", plan: "starter", autoDeploy: "commit", maxShutdownDelaySeconds: 60,
  buildFilter: { ignoredPaths: ["docs/**"] },
};
web("api").node().repo(url).build("pnpm build").start("pnpm start").with(acmeDefaults);
```

`.with()` is how you set fifteen fields without fifteen calls. It is deliberately *state-preserving*: it
accepts only fields already unlocked and never advances a stage, so it can never satisfy `.start()`,
`.schedule()`, `.publish()` or `.ipAllowList()`. That keeps the guarantees intact at the price of two ways to
set the same field — a real cost in a library that otherwise prides itself on one way.

**Can the builder accept a plain config object?** Partially. `.with()` covers the optional surface; the
required transitions stay method calls. A full `web("api", { …everything… })` overload would have to
re-encode every rule as an optionality constraint on one object type — that is the design being competed
against, not this one.

**Chained immutability has no `must_use`.** `api.env({...})` returns a new builder; dropping the return value
silently loses the env vars and TypeScript cannot flag it. Mitigation is weak (a lint rule for
unused-expression builder calls; a dropped chain often also drops the readiness brand). Mistake #23 is
genuinely uncaught.

**Compilation cost.** Deep conditional intersections plus `DuplicateNames<T>` over the resources tuple can
turn a 200-line config into a slow type-check. Budget for it; keep the duplicate-name check behind an opt-in
overload if it measures badly.

## 9. Open decisions for the implementer

1. **Track referenced names in the type parameter?** Accumulating `Refs` would move mistake #16 (dangling
   in-blueprint reference) to compile time, but doubles the type-parameter surface on every service and makes
   hover text unreadable. Default: leave it at synth.
2. **Compile-time duplicate names.** `DuplicateNames<T>` over the `resources` tuple works when every name is
   a literal. Always on, opt-in, or dropped in favour of the synth-time issue?
3. **Poison members versus pure absence.** Good errors, polluted autocomplete; `@deprecated` mitigates but
   does not remove them. The eight chosen here are a guess; measure.
4. **Prose or schema for the `serverService` looseness (§4.8 ⚠, §16-F).** This design follows the prose and
   denies `healthCheck` / `domains` / `maintenanceMode` / `ipAllowList` on `worker` and `pserv`, pushing
   users to `.extra()` if Render actually honours them there.
5. **Legacy plan names.** `basic-1gb` (canonical scenario) is a schema-only legacy identifier, kept with a
   `@deprecated` JSDoc. Keep the other ~20, or force `.extra({ plan })`?
6. **`version: "1"`** (§16-D) — emit always, never, or as a `blueprint()` option. Currently `.extra()`.
7. **`previews.generation: "off"` on services** — schema allows it, prose lists only `manual`/`automatic`
   (§16-C). Currently allowed. Same question for `.env()` called twice (currently merges, later wins).
8. **Drift comparison in `--check`** — byte-identical, or parse and compare semantically? Byte is stricter
   and simpler; semantic survives a reformat.
