# Alternative A — YAML mirror: the data model is the product

Constraint: minimise the API surface. One entry point, zero value-constructor helpers, every
feature expressed as data. Seeded by `iac-dx-survey.md` §5(a).

## 1. Design thesis

The blueprint is one object literal mirroring `render.yaml` key for key, except that every YAML
list-with-`name:` becomes a map keyed by that name. There is nothing to *call* — no `web()`, no
`fromDatabase()`, no `secret()`. `defineBlueprint` is an identity-shaped function whose only job is
to trigger inference and then re-check the same literal against the names it just declared.
Field-level legality comes from a `(type, runtime)` discriminated union; reference legality from
`keyof` over sibling maps. Learning the library is learning `render.yaml`.

## 2. Interface signature

Three exported functions. Seven exported error classes. Zero value-constructor helpers.

```ts
export declare function defineBlueprint<const B extends BlueprintDraft>(
  input: B & CheckedBlueprint<B>,
): Blueprint;

export declare function toYaml(blueprint: Blueprint): ResultType<SynthOutput, SynthesisError>;

export declare function writeBlueprint(
  blueprint: Blueprint,
  options: WriteOptions,
): Promise<ResultType<WriteOutcome, SynthesisError | BlueprintUnreadable | BlueprintUnwritable | BlueprintDrifted>>;
```

### 2.1 The two-pass generic (how names get checked)

One generic type, `BlueprintInput<R>`, is instantiated twice against the *same* literal:

```ts
// Pass 1 — permissive: every reference position is `string`. Gives full editor completion on
// plan / region / runtime while the user is still typing, before any key exists.
export type BlueprintDraft = BlueprintInput<AnyRefs>;
// Pass 2 — precise: reference positions narrow to the names actually declared in B.
type CheckedBlueprint<B> = BlueprintInput<RefsOf<B>>;

export interface RefNames {
  readonly databases: string;                                    // legal fromDatabase names
  readonly groups: string;                                       // legal fromGroups names
  readonly serviceKinds: { readonly [name: string]: RefServiceKind };
  readonly serviceEnvKeys: { readonly [name: string]: string };
}

export interface ExternalRefs {                                  // never emitted; typing only
  readonly services?: { readonly [name: string]: RefServiceKind };
  readonly databases?: readonly string[];
  readonly envVarGroups?: readonly string[];
}
```

`RefsOf<B>` is a pure type-level fold over the literal. `databases` = `keyof B["databases"]` ∪ every
`readReplicas` entry ∪ `external.databases`; `groups` = `keyof B["envVarGroups"]` ∪
`external.envVarGroups`; both also collect the maps nested in `projects[].environments[]` and
`ungrouped`. `serviceKinds` maps each service name to its *reference* kind derived from
`(type, runtime)` — `web`+`static`→`static`, `private`→`pserv`, else unchanged — merged with
`external.services`. `serviceEnvKeys[N]` = `keyof B["services"][N]["envVars"] |
RenderProvidedEnvKey`, or `string` for an external target.

`external` is the design's answer to `spec §12`: a reference may point at a workspace resource
this file does not define, and declaring that fact is *data*, not an escape hatch. It also supplies
the `type:` for such a reference, so the emitted `fromService` is complete without the user writing
one. Because the parameter is `B & CheckedBlueprint<B>`, an undeclared name fails at the offending
property: *Types of property 'name' are incompatible. Type `"main-db-typo"` is not assignable to
type `"main-db" | "main-db-replica"`.*

### 2.2 `(type, runtime)` discrimination

```ts
export type ServiceInput<R extends RefNames> =
  | ServerService<"web", R>       // type: "web",     runtime: NativeRuntime | "docker" | "image"
  | StaticSite<R>                 // type: "web",     runtime: "static"
  | ServerService<"worker", R>
  | ServerService<"private", R>   // emitted as pserv
  | CronService<R>                // type: "cron",    schedule required
  | KeyValueService;              // type: "keyvalue", ipAllowList required, no runtime/envVars

type ServerService<T extends "web" | "worker" | "private", R extends RefNames> =
  { readonly type: T } & Source & Common<R> & ServerOnly<R> & (T extends "web" ? WebOnly : {});

// Source is itself a three-way union on `runtime`, so repo / Dockerfile / prebuilt-image
// fields never coexist. `Exclusive` (see 2.3) adds `?: never` for the other branches' keys.
type Source =
  | Exclusive<{ runtime: NativeRuntime; repo?: string; branch?: string; rootDir?: string;
                buildCommand?: string; startCommand?: string }, SourceKeys>
  | Exclusive<{ runtime: "docker"; repo?: string; branch?: string; rootDir?: string;
                dockerfilePath?: string; dockerContext?: string; dockerCommand?: string;
                registryCredential?: RegistryCredential }, SourceKeys>
  | Exclusive<{ runtime: "image"; image: { url: string; creds?: RegistryCredential } }, SourceKeys>;

interface ServerOnly<R extends RefNames> {
  readonly plan?: ServerPlan; readonly region?: Region; readonly scaling?: Scaling;
  readonly disk?: { readonly name: string; readonly mountPath: string; readonly sizeGB?: number };
  readonly instances?: number;                                    // renamed from numInstances
  readonly maxShutdownDelaySeconds?: number;
  readonly previews?: { generation?: PreviewsGeneration; plan?: ServerPlan; instances?: number };
}
interface WebOnly {                            // [SPEC] restricts these four to web services
  readonly healthCheckPath?: `/${string}`; readonly domains?: readonly string[];
  readonly maintenanceMode?: { readonly enabled?: boolean; readonly uri?: string };
  readonly renderSubdomainPolicy?: "enabled" | "disabled"; readonly ipAllowList?: readonly IpRule[];
}
interface Common<R extends RefNames> {
  readonly preDeployCommand?: string; readonly initialDeployHook?: string;
  readonly autoDeployTrigger?: "commit" | "checksPass" | "off"; readonly extra?: ExtraFields;
  readonly buildFilter?: { readonly paths?: readonly string[]; readonly ignoredPaths?: readonly string[] };
  readonly envVars?: { readonly [key: string]: EnvValue<R> };
  readonly fromGroups?: readonly R["groups"][];                   // → envVars: [{fromGroup: …}]
}
```

`spec §4.8` transcribed into six members. `StaticSite` adds `staticPublishPath`, `headers`, `routes`
and a one-field `previews`, and drops `plan`/`region`/`startCommand`/`disk`/`scaling`/`instances`/
`healthCheckPath`/`initialDeployHook`. `CronService` requires `schedule`, takes `plan?: CronPlan`,
has no `disk`/`scaling`/`previews`/`domains`. `KeyValueService` requires `ipAllowList` and takes
only `plan?: KeyValuePlan`, `previewPlan?`, `maxmemoryPolicy?`, `persistenceMode?`, `region?`,
`extra?` — no `runtime`, no `envVars`.

### 2.3 The env var value type

All five YAML shapes are union members, so exclusivity is structural. `Exclusive<Self, All>`
adds `?: never` for every sibling key, which is what makes TypeScript reject a mixed literal
instead of silently picking a member.

```ts
type Exclusive<Self, All extends string> =
  Self & { readonly [K in Exclude<All, keyof Self>]?: never };

export type EnvValue<R extends RefNames> =
  | string | number                                                        // → value:
  | Exclusive<{ value: string | number; previewValue?: string | number }, EnvKeys>
  | Exclusive<{ secret: true }, EnvKeys>                                   // → sync: false
  | Exclusive<{ generateValue: true }, EnvKeys>
  | Exclusive<{ fromDatabase: { name: R["databases"]; property: DatabaseProperty } }, EnvKeys>
  | Exclusive<{ fromService: ServiceRef<R> }, EnvKeys>;

export type ServiceRef<R extends RefNames> = {
  readonly [N in keyof R["serviceKinds"] & string]:
    | { readonly name: N; readonly type?: R["serviceKinds"][N];
        readonly property: PropertyFor<R["serviceKinds"][N]> }
    | { readonly name: N; readonly type?: R["serviceKinds"][N];
        readonly envVarKey: R["serviceEnvKeys"][N] };
}[keyof R["serviceKinds"] & string];

type PropertyFor<K extends RefServiceKind> =
  K extends "keyvalue" ? "connectionString" : "host" | "port" | "hostport";

export type EnvVarGroupInput =                  // groups: no refs, no secrets (spec §10)
  { readonly [key: string]: string | number
      | Exclusive<{ value: string | number; previewValue?: string | number }, EnvKeys>
      | Exclusive<{ generateValue: true }, EnvKeys> };
```

Three checks fall out for free: `property` XOR `envVarKey` (two members, no overlap); the property
set narrows per referenced service kind (`spec §6.2` — Key Value only exposes `connectionString`);
and `envVarKey` on an in-blueprint target is checked against that service's own env var keys plus
Render's documented defaults (`RENDER_EXTERNAL_HOSTNAME`, `PORT`, … — `spec §6.6`). `type` is
optional and derived when omitted; supplying a wrong one is an error.

### 2.4 Databases, root, and results

```ts
export interface DatabaseInput {
  readonly plan?: PostgresPlan; readonly previewPlan?: PostgresPlan; readonly region?: Region;
  readonly databaseName?: string; readonly user?: string; readonly ipAllowList?: readonly IpRule[];
  readonly postgresMajorVersion?: PostgresMajorVersion;   // "10" … "18", string only
  readonly diskSizeGB?: number; readonly previewDiskSizeGB?: number;
  readonly storageAutoscalingEnabled?: boolean; readonly connectionPool?: "pgbouncer" | "none";
  readonly readReplicas?: readonly string[];              // names; YAML wants [{name}]
  readonly highAvailability?: { readonly enabled: boolean };
  readonly extra?: ExtraFields;
}

interface ResourceMaps<R extends RefNames> {
  readonly services?: { readonly [name: string]: ServiceInput<R> };
  readonly databases?: { readonly [name: string]: DatabaseInput };
  readonly envVarGroups?: { readonly [name: string]: EnvVarGroupInput };
}

type BlueprintInput<R extends RefNames> = ResourceMaps<R> & {
  readonly previews?: { readonly generation?: PreviewsGeneration; readonly expireAfterDays?: number };
  readonly external?: ExternalRefs;
  readonly ungrouped?: ResourceMaps<R>;
  readonly projects?: readonly { readonly name: string; readonly environments: readonly (
      ResourceMaps<R> & { readonly name: string;
        readonly networking?: { readonly isolation: "enabled" | "disabled" };
        readonly permissions?: { readonly protection: "enabled" | "disabled" } })[] }[];
  readonly extra?: ExtraFields;
};

export interface SynthOutput { readonly yaml: string; readonly warnings: readonly BlueprintWarning[] }
export interface WriteOptions { readonly path: string; readonly mode: "write" | "check" }
export type WriteOutcome = { readonly kind: "written" | "unchanged"; readonly path: string;
  readonly warnings: readonly BlueprintWarning[] };

// Errors. Each is a TaggedError; each payload carries a `path` like
// "services.api.envVars.DATABASE_URL" plus the fields a CI reporter needs.
export class DuplicateResourceName extends TaggedError("DuplicateResourceName")<{
  name: string; locations: readonly string[]; message: string }> {}
export class DanglingReference extends TaggedError("DanglingReference")<{
  path: string; kind: "service" | "database" | "envVarGroup"; name: string; message: string }> {}
export class InvalidFieldValue extends TaggedError("InvalidFieldValue")<{
  path: string; field: string; rule: string; siblings: readonly string[]; message: string }> {}
export class UnmodeledFieldConflict extends TaggedError("UnmodeledFieldConflict")<{
  path: string; field: string; message: string }> {}
export class BlueprintDrifted extends TaggedError("BlueprintDrifted")<{
  path: string; diff: string; message: string }> {}
export type SynthesisError =
  | DuplicateResourceName | DanglingReference | InvalidFieldValue | UnmodeledFieldConflict;
```

`toYaml` collects every failure and returns the first as `Err` with the rest in `siblings` —
**INFERRED**; better-result has one error lane, and reporting one prose violation per CI run
would be miserable.

## 3. Usage example — the canonical scenario

`apps/api/render.ts` — a per-app fragment, no root context available:

```ts
import type { ServiceDraft } from "render-blueprint";

export const apiService = {
  type: "web", runtime: "node",
  repo: "https://github.com/acme/api", branch: "main",
  buildCommand: "pnpm build", startCommand: "pnpm start",
  healthCheckPath: "/healthz",
  scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
  previews: { plan: "starter" },
  fromGroups: ["shared-settings"],
  envVars: {
    DATABASE_URL: { fromDatabase: { name: "main-db", property: "connectionString" } },
    REDIS_URL: { fromService: { name: "cache", property: "connectionString" } },
    STRIPE_KEY: { secret: true },
    APP_HOST: { fromService: { name: "api", envVarKey: "RENDER_EXTERNAL_HOSTNAME" } },
  },
} as const satisfies ServiceDraft;
```

`render.ts` at the repo root:

```ts
import { BlueprintDrifted, defineBlueprint, writeBlueprint } from "render-blueprint";
import { apiService } from "./apps/api/render.ts";

export const blueprint = defineBlueprint({
  previews: { generation: "automatic", expireAfterDays: 7 },
  external: { services: { "legacy-auth": "pserv" } },
  databases: {
    "main-db": { plan: "basic-1gb", region: "oregon", postgresMajorVersion: "16",
                 readReplicas: ["main-db-replica"] },
  },
  envVarGroups: {
    "shared-settings": { LOG_LEVEL: "info", SESSION_SECRET: { generateValue: true } },
  },
  services: {
    api: apiService,
    cache: { type: "keyvalue", plan: "free", ipAllowList: [], maxmemoryPolicy: "allkeys-lru" },
    jobs: {
      type: "worker", runtime: "docker",
      repo: "https://github.com/acme/api", dockerfilePath: "./Dockerfile.jobs",
      envVars: {
        API_URL: { fromService: { name: "api", property: "hostport" } },
        AUTH_HOST: { fromService: { name: "legacy-auth", property: "host" } },
      },
    },
    "nightly-report": {
      type: "cron", runtime: "node", schedule: "0 2 * * *", startCommand: "pnpm report",
    },
    web: {
      type: "web", runtime: "static",
      buildCommand: "pnpm build", staticPublishPath: "./dist",
      routes: [{ type: "rewrite", source: "/*", destination: "/index.html" }],
      headers: [{ path: "/*", name: "X-Frame-Options", value: "DENY" }],
    },
  },
});

const outcome = await writeBlueprint(blueprint, {
  path: "render.yaml",
  mode: process.argv.includes("--check") ? "check" : "write",
});

process.exitCode = outcome.match({
  ok: (value) => { value.warnings.forEach((w) => console.warn(w.message)); return 0; },
  err: (error) => { console.error(error.message); return BlueprintDrifted.is(error) ? 2 : 1; },
});
```

`node --experimental-strip-types render.ts` writes the file; `… render.ts --check` exits 2 on
drift (Terraform `--detailed-exit-code` semantics, per `iac-dx-survey.md` §3). No bundled CLI;
the script *is* the CLI, and it is eight lines.

## 4. What it hides

- **Map → list.** Resource maps become arrays with the key injected as `name:`; `envVars` maps
  become key/value objects; `fromGroups` entries are appended as `{fromGroup: …}` after the keyed
  ones; `readReplicas` names become `[{name}]`.
- **Renames.** `private`→`pserv`, `instances`→`numInstances`, `{secret: true}`→`sync: false`,
  `fromGroups`→`envVars` entries. Everything else keeps Render's own field name.
- **`fromService.type` derivation** from the referenced service's `(type, runtime)` or from
  `external.services`, so the two-enum mismatch in `spec §6.2` never reaches the user.
- **Deprecated forms.** `env`, `autoDeploy`, `previewsEnabled`, `previewsExpireAfterDays`,
  `pullRequestPreviewsEnabled`, service `previewPlan`, `type: redis`, singular `domain` and
  `afterFirstDeployCommand` are absent from every type and never emitted. Key Value and Postgres
  `previewPlan` stay — there they are the current form (`spec §13`).
- **Emission.** Deterministic key order (root keys in spec order, resources in literal insertion
  order), quoting of names with spaces, `postgresMajorVersion` forced to a string, a
  `# Generated by render-blueprint. Do not edit.` header, and a
  `# yaml-language-server: $schema=https://render.com/schema/render.yaml.json` modeline. Output is
  checked against the bundled `render.yaml.schema.json` before return; failing that is a library
  bug, surfaced as `InvalidFieldValue` with `rule: "schema"`. `external` is stripped.

## 5. Mistake matrix

Layers: **C** = compile error, **S** = synth-time `Result` error, **W** = synth-time warning in
`SynthOutput.warnings`, **R** = passes through to Render.

| # | Mistake | Layer | Mechanism |
|---|---------|-------|-----------|
| 1 | `{ fromService: { name: "cache", property: "host" } }` (keyvalue only has `connectionString`) | **C** | `PropertyFor<"keyvalue">` narrows to one literal |
| 2 | `disk` on a cron job | **C** | `disk` absent from `CronService`; excess property on a discriminated member |
| 3 | `plan` or `region` on a static site | **C** | absent from `StaticSite`; the union member is selected by `runtime: "static"` |
| 4 | `fromDatabase: { name: "main-db-typo" }` | **C** | `R["databases"]` = `"main-db" \| "main-db-replica"` |
| 5 | Two resources with the same name and kind | **C** | duplicate object literal key |
| 6 | A service and a database both named `cache`; or one resource at root *and* in an environment | **S** | `DuplicateResourceName` (`spec §1`) |
| 7 | `type: "cron"` without `schedule`; `keyvalue` without `ipAllowList` | **C** | required properties (`spec §3.1`, `§5`) |
| 8 | `{ secret: true }` inside an env var group | **C** | `EnvVarGroupInput` omits that member (`spec §10`) |
| 9 | `{ value: "x", generateValue: true }` | **C** | `Exclusive<>` sets `generateValue?: never` on the value member |
| 10 | `fromService` with both `property` and `envVarKey` | **C** | two disjoint `ServiceRef` members |
| 11 | `scaling: { minInstances: 3, maxInstances: 1 }` | **S** | `InvalidFieldValue`, `rule: "scaling.min<=max"` |
| 12 | `healthCheckPath: "healthz"` | **C** | `` `/${string}` `` template literal type |
| 13 | `envVarKey: "RENDER_EXTERNAL_HOSTNAM"` on an in-blueprint target | **C** | `R["serviceEnvKeys"]["api"]` = that service's keys ∪ `RenderProvidedEnvKey` |
| 14 | Referencing `legacy-auth`, which lives only in the workspace | **C, allowed** | legal once declared in `external.services`; undeclared → row 4 |
| 15 | Service declared in `apps/api/render.ts` and imported | **C** | the root literal spreads it, so pass 2 sees its references — *if* written `as const satisfies ServiceDraft` |
| 16 | Same, but the fragment was annotated `const x: ServiceDraft = …` | **S** | literals widen to `string`, so pass 2 sees nothing; synth still resolves every name against declared ∪ `external` and raises `DanglingReference`. See §8 |
| 17 | Declared a resource in a file and never imported it | **W** in `--check` | no registration list exists; "declared but not included" is just an unused export |
| 18 | `autoDeploy: true` (deprecated); `postgresMajorVersion: 16` (number) | **C** | not in any type; string-literal enum |
| 19 | `diskSizeGB: 7` on a database; `targetCPUPercent: 120`; six `readReplicas` | **S** | range/count rules from `spec §8.3` |
| 20 | `disk` together with `scaling` on one service | **S** | optional siblings; a type-level split would double the union |
| 21 | Native runtime with no `buildCommand`; `branch` set, which disables preview envs | **W** | prose-vs-schema conflict; legal but surprising (`spec §11`, §9 below) |
| 22 | Omitting `buildFilter` on a service that has one in the dashboard (destructive) | **R** | needs live state, which this library refuses to have |

## 6. Preview and environment overrides

Overrides are fields, not a mode. Nothing switches on an ambient stage.

```ts
previews: { generation: "automatic", expireAfterDays: 7 },              // root
services: {
  api:   { previews: { generation: "automatic", plan: "starter", instances: 1 },
           envVars: { TIER: { value: "prod", previewValue: "preview" } } },
  web:   { previews: { generation: "manual" } },                        // static: generation only
  cache: { previewPlan: "free" },                                       // keyvalue: flat field
},
databases: { "main-db": { previewPlan: "0.1c-256mb", previewDiskSizeGB: 5 } },
projects: [{ name: "acme", environments: [
  { name: "production", networking: { isolation: "enabled" },
    permissions: { protection: "enabled" }, services: { api: apiService } },
  { name: "staging", services: { api: { ...apiService, plan: "starter" } } },
]}],
```

The types enforce the asymmetry documented in `spec §4.6`/`§11`: server services get the nested
three-field object, static sites a one-field object, Key Value and Postgres the flat `previewPlan`,
and cron jobs nothing at all. Projects and environments are the same maps one level down;
per-environment variation is a spread and an override, no DSL. A resource must appear in exactly
one location (`spec §1`); appearing twice is mistake #6.

## 7. Escape hatch

Every resource input and the root carry `extra`:

```ts
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ExtraFields = { readonly [field: string]: JsonValue };
```

`extra` is merged into that resource's emitted mapping after the modeled fields. A key colliding
with a field the library already models is `UnmodeledFieldConflict` at synth, never a silent
override — otherwise `extra` becomes a second, untyped way to set `plan`. It is excluded from the
bundled-schema conformance check, since its purpose is fields that schema predates. No `unknown`,
no `Record<string, unknown>`, no assertions.

## 8. Trade-offs

**Cross-file composition is the weak spot, and the type system goes only half way.** A fragment in
`apps/api/render.ts` cannot see the root's names, so it cannot be checked locally. The answer here
is that the fragment is *unchecked data* — `satisfies ServiceDraft` gives field-level checking only
— and the root `defineBlueprint` call is the single place references are verified. Spreading a
literal-typed value into the root object preserves its literal types through `const B`, so that
works. It stops at exactly one place: if the fragment author writes `const apiService: ServiceDraft
= {…}` instead of `as const satisfies ServiceDraft`, every reference widens to `string` and pass 2
has nothing to compare. The failure then demotes from a compile error to a synth-time
`DanglingReference` (matrix #16) — still caught, but in CI rather than in the editor, and silently
so, because nothing tells the author their file stopped being checked. A lint rule can require
`as const satisfies`; the type system cannot. A design whose references are *values* carried across
the file boundary has no such cliff.

**Deep mapped types are expensive.** `CheckedBlueprint<B>` walks the whole literal, so on a
50-service monorepo blueprint it dominates `tsc` time, and nested `projects[].environments[]` makes
instantiation depth a real risk. `isolatedDeclarations` also forces `Blueprint` to be a named opaque
interface rather than anything inferred.

**Error messages degrade with union width.** When a service literal matches no member of a six-way
union, TypeScript reports the last member tried — the classic "Property `staticPublishPath` is
missing" for a typo in a worker. Ordering the union and putting `type` first in every member helps;
it is a mitigation, not a fix. Relatedly, pass 1 types reference positions as `string`, so the
editor offers no completion at `name:` until the literal is complete enough for pass 2 to run.

**Everything is one expression.** No mutation after construction, no `addEnv`, and no cascading
defaults scope — `region`, `repo` and `branch` repeat on every service, an ergonomic win the survey
names and this design gives up. A plain function returning a `ServiceDraft` plus object spread
recovers most of it.

**What it buys.** Nothing to learn beyond `render.yaml`; an importer (`render.yaml` → TS) becomes
close to a mechanical transform, the strongest adoption ramp available; "declared but forgotten"
disappears for inline resources because being a key *is* being registered; and 16 of 22 matrix rows
are compile errors.

## 9. Open decisions

1. **`buildCommand` / `startCommand` required?** `[SPEC]` calls both required for non-Docker
   services, `[SCHEMA]` requires neither, and the canonical cron job has no `buildCommand`. This
   design warns; making them compile-required is a one-line change and a real compatibility break.
2. **`diskSizeGB` at compile time.** `1 | 5 | 10 | …` is expressible as a generated union up to some
   ceiling. Chose S over C to avoid a 200-member union and a ceiling that ages badly.
3. **Strictness beyond the schema.** This design forbids `repo` alongside `runtime: "image"`,
   forbids `healthCheckPath`/`domains`/`maintenanceMode` on worker and private services, and forbids
   `runtime: "static"` on non-web types — all cases where `[SCHEMA]` is looser than `[SPEC]`
   (`spec §16 F, G`). If Render accepts any of them, `extra` is the only way out.
4. **`RenderProvidedEnvKey` completeness.** The `spec §6.6` list is what Render documents; a build
   may inject others. The union is currently closed for in-blueprint targets, which is what makes
   matrix #13 work and what makes an undocumented key a compile error.
5. **Reporting channels.** Multi-error: first error plus `siblings` (chosen, **INFERRED**) versus an
   `AggregateSynthesisError`. Warnings ride in the `Ok` value; a `logger` option on `WriteOptions`
   is the alternative, and adds a callback to a surface whose selling point is having none.
6. **`version: "1"`** is `[SCHEMA]`-only and undocumented on `[SPEC]` (`spec §16 D`); not emitted.
   **`fromGroups`** is a fourth rename beyond `pserv`/`numInstances`/`sync: false`, forced because
   `{fromGroup: x}` is a keyless list entry with nowhere to live in a keyed map.
