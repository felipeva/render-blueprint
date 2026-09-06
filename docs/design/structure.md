# Structure — repository layout, boundaries, and conventions

Phase 2. Inputs: ADR-0001 (design B plus three borrowings), ADR-0002 (library primary, thin CLI),
`docs/design/alternatives/b-factories-typed-refs.md` §2 (the interface this document arranges into
files), `docs/design/requirements.md`, `docs/research/toolchain.md` Part 3,
`docs/research/better-result.md` §5. Nothing here reopens an ADR; anything not traceable to those
documents is marked **INFERRED**.

## 0. Names settled here

ADR-0002 defers the final entry-point names here. Design B §2.5 proposed `synthesize` /
`writeToFile` / `checkForDrift`; ADR-0002 wrote `writeBlueprint` / `checkBlueprint`. The ADR wins
and the third name aligns with it; every other name in design B §2 is kept verbatim.

| Final | Design B §2.5 | Returns |
| --- | --- | --- |
| `synthesize` | `synthesize` | `ResultType<SynthesisReport, BlueprintInvalid>` |
| `writeBlueprint` | `writeToFile` | `Promise<ResultType<WriteReport, BlueprintInvalid \| BlueprintWriteFailed>>` |
| `checkBlueprint` | `checkForDrift` | `Promise<ResultType<DriftReport, BlueprintInvalid \| BlueprintFileUnreadable>>` |

## 1. Package layout

**One package. No pnpm workspace.** The CLI is a `bin` entry in it.

ADR-0002 fixes the CLI at three jobs — discover `render.ts`, load it through Node type stripping,
map the `Result` to exit codes 0/1/2 — and gives it no logic of its own. Four source files do not
earn a second package, a `workspace:*` link, a second tsconfig, and a publish ordering constraint.
Consumers install one thing, so `npx render-blueprint check` works in CI from the dependency they already
have; splitting forces `render-blueprint` plus `render-blueprint-cli` on everyone. tsdown emits both entries from one
config, and the toolchain doc's `tsconfig.json` skeleton omits `composite`/`incremental` as
"irrelevant for a single-package library" — staying single keeps it usable unmodified. The cost,
the CLI shipping to library-only consumers, is `node:fs` + `node:path` + a dynamic `import()`.
Revisit only if the CLI grows a real dependency. `render-blueprint` is the npm name, decided separately.

## 2. Folder tree

```
.
├── .agents/skills/                  vendored agent skills — the source of truth
│   ├── install-anti-slop/           existing; scripts/install.mjs writes tools/oxlint/anti-slop/
│   └── adopt-better-result/         NEW — vendored from .reference (§2.1)
├── .claude/skills/                  symlinks into ../../.agents/skills
├── .github/workflows/ci.yml         install, `pnpm check`, `pnpm build` — INFERRED, no doc mandates CI
├── docs/                            unchanged: adr/ agents/ design/ research/ research/raw/
├── scripts/refresh-render-schema.mjs  re-downloads the Render JSON Schema into test/schema/ (§6.3)
├── src/                             the only compiled source root (tsconfig rootDir)
│   ├── index.ts                     THE public entry — re-exports only, no logic
│   ├── testing.ts                   the `render-blueprint/testing` subpath — memoryFilePort only,
│                                    so a consumer's runtime bundle never carries the in-memory port
│   ├── json.ts                      JsonValue / JsonObject — the escape-hatch types (design B §7)
│   ├── enums/                       `as const` tuples + derived unions, one family per file: region,
│   │                                runtime, plan, disk-size, auto-deploy-trigger, maxmemory-policy,
│   │                                preview-generation, service-type, render-provided-key (spec §6.6)
│   ├── references/                  what a resource exposes; the core of design B
│   │   ├── reference-value.ts       DatabaseReferenceValue, ServiceReferenceValue (the XOR union)
│   │   ├── postgres-reference.ts  key-value-reference.ts  http-service-reference.ts   the four
│   │   ├── opaque-service-reference.ts   handles: host/port/hostport vs envVar/renderVar only
│   │   └── external.ts              the `external` object — handles with no `kind`, so unlistable
│   ├── env/                         env values and the map→list problem
│   │   ├── env-value.ts             EnvValue, EnvGroupValue, EnvironmentMap, EnvGroupEnvironment
│   │   ├── literal.ts  secret.ts  generated.ts   the three "value lives elsewhere" sentinels
│   │   └── resolve-env.ts           map | (self)=>map + envGroups → ordered entries; detects the
│                                    group/direct collision and duplicate keys (ADR-0001, from D)
│   ├── resources/                   one factory per kind; each returns an inert value
│   │   ├── service-fields.ts        the shared maps of common repo-sourced service fields, required and
│   │   │                            exact-optional forms; factories spread them (ADR-0003, issue #20)

│   │   ├── resource.ts  source.ts   the BlueprintResource union and `kind` discriminator; the
│   │   │                            repo+branch | dockerfilePath | image source union
│   │   ├── disk.ts  scaling.ts  build-filter.ts  ip-allow-list.ts  previews.ts
│   │   │                            the sub-configs shared across service kinds. Route and Header
│   │   │                            are not shared — only a static site takes them (spec §4.8), so
│   │   │                            they live in static-site.ts with the factory (issue #6)
│   │   ├── web.ts  private-service.ts  worker.ts  cron.ts  static-site.ts  key-value.ts
│   │   │   postgres.ts  env-group.ts   each: the factory, its Config, and its output type
│   │   └── read-replica.ts          referenceable, deliberately outside BlueprintResource
│   ├── defaults/                    the withDefaults scope
│   │   ├── resource-defaults.ts  apply-defaults.ts   ResourceDefaults/PlanDefaults; the kind × field
│   │   └── with-defaults.ts         matrix filter, per-resource always winning; the nestable scope
│   ├── blueprint/                   the explicit root and its placement axes
│   │   ├── blueprint.ts  group.ts  project.ts  environment.ts   all total; none validates
│   │   └── placement.ts             flattens root / projects[].environments[] / ungrouped into one list
│   ├── validation/                  every rule the compiler cannot express
│   │   ├── validate.ts  issue.ts    THE entry, Blueprint → ok(ValidatedBlueprint) | err(...); plus
│   │   │                            ValidationIssue, ValidationCode, ResourcePath, ValidationWarning
│   │   ├── blueprint-invalid.ts     the BlueprintInvalid class — declared at its only producer (§5)
│   │   └── rules/                   one pure Blueprint → issues[] file per family: duplicate-name,
│                                     dangling-reference, multiple-locations, env-collision, scaling,
│                                     service-env-var-key, numeric-range, high-availability,
│                                     extra-field-conflict, warnings
│   ├── synth/                       the ONLY module that knows YAML exists
│   │   ├── synthesize.ts  document.ts   validate → document → emit; ValidatedBlueprint → a Document
│   │   ├── mapping.ts  key-order.ts   the ordered builder that never writes an undefined value (§5),
│   │   │                            and the root and env-entry key orders; each resource's field order is the tuple beside its factory
│   │   ├── services.ts              the four disjoint service branches + (type, runtime) discrimination
│   │   ├── databases.ts             postgres → `databases:`, read-replica registration
│   │   ├── env-vars.ts              map → `envVars:` list, `fromGroup` entries, the five value forms
│   │   ├── projects.ts  banner.ts   projects[].environments[] and `ungrouped`; the banner
│   │   └── parse-text.ts  canonical-text.ts   the read direction, for drift/ only: text → JsonValue
│   │                                under the 1.2 core schema, and JsonValue → key-sorted YAML.
│   │                                drift/ never imports `yaml`; it receives a JsonValue.
│   ├── drift/  check-blueprint.ts   synthesize + read + compare → DriftReport
│   │   ├── normalize.ts  diff.ts    parses and re-emits the committed file so an equivalent one
│   │   │                            compares clean; the unified diff DriftReport carries
│   │   └── immutable-field.ts       classifies changes Render cannot apply in place — type and
│   │                                region (spec §4.1), runtime (issue #8), the database fields
│   │                                (spec §9) — and owns the JsonValue accessors it alone needs
│   ├── fs/                          the only module that touches the filesystem
│   │   ├── write-blueprint.ts       the public writeBlueprint()
│   │   ├── file-port.ts             FileReader + FileWriter + FilePort: the injected seam.
│   │                                FilePort also carries exists(), which the CLI's walk up from
│   │                                the working directory needs (issue #11)
│   │   ├── node-file-port.ts        the default; its writer creates the parent directories, and
│   │                                it is re-exported from index.ts so the CLI can name it
│   │   ├── memory-file-port.ts      the in-memory implementation, published at the testing subpath
│   │   └── write-text-file.ts  read-text-file.ts   the two Result.tryPromise boundaries; each
│   │                                declares the error it produces — BlueprintWriteFailed and
│   │                                BlueprintFileUnreadable (§5). There is no src/errors/.
│   └── cli/                         nothing in src/ outside this directory may import it
│       ├── main.ts                  the bin entry; the ONE isPanic boundary; exit codes 0/1/2
│       ├── discover.ts  load.ts     walk up from cwd for render.ts (--file overrides), then import()
│       ├── parse-arguments.ts       the hand-rolled command line: two commands, three flags, and
│       │                            CommandLineInvalid. No dependency, because the library would
│       │                            ship it to every consumer
│       ├── node-floor.ts            refuses a Node older than the type-stripping floor with a
│       │                            sentence, rather than letting the loader fail (§7 engines)
│       └── format.ts                human rendering of issues, warnings, and the drift diff
├── test/                            cross-module tests only; unit tests live beside their source
│   ├── golden.test.ts               fixtures/canonical/render.ts → byte-equal render.yaml (§6.2)
│   ├── schema-conformance.test.ts   parse the golden YAML, validate against the Render schema (§6.3)
│   ├── cli.test.ts                  spawn the binary in a temp dir; assert exit codes 0/1/2 (§6.6)
│   ├── fixtures/canonical/render.ts   design B §3 verbatim — the scenario every design doc shares
│   ├── fixtures/canonical/render.yaml the golden output; the only file `vitest -u` may rewrite
│   ├── fixtures/cli/                seed directories — clean, drifted, invalid, warned. Each
│   │                                holds render.ts.seed, whose import specifier is a placeholder
│   │                                the smoke test rewrites to the built entry's file URL
│   └── schema/render.yaml.schema.json the conformance oracle, refreshed by script only (§6.3)
├── tools/oxlint/anti-slop/          written by the install skill; committed; never linted or edited
└── .gitignore  .oxfmtrc.json  .oxlintrc.json  CLAUDE.md  package.json  pnpm-lock.yaml
    skills-lock.json  tsconfig.check.json  tsconfig.json  tsdown.config.ts  vitest.config.ts
```

Colocated tests are not listed: `src/**/x.ts` may have `src/**/x.test.ts` (runtime) and
`src/**/x.test-d.ts` (types) next to it.

### 2.1 `.agents/skills/adopt-better-result/` — vendor it

`.reference/` is gitignored, so a worktree agent gets no better-result doctrine unless it is
vendored — exactly why `install-anti-slop` was vendored first.
`.reference/better-result/skills/adopt-better-result/` exists and contains, verified: `SKILL.md`
(67 lines; an audit branch and a named-slice implementation branch, the first feeding the second)
plus `references/tagged-errors.md` (81), `repository-audit.md` (74), `result-boundaries.md` (56),
`vertical-slice-migration.md` (60). Copy it into `.agents/skills/`, add the `.claude/skills/`
symlink the way `install-anti-slop` has one, and add a `skills-lock.json` entry with
`source: "dmmulroy/better-result"`, `skillPath: "skills/adopt-better-result/SKILL.md"` and the
computed hash. Upstream is `better-result@3.0.1`.

## 3. Module boundaries and dependency direction

Imports flow strictly up this list. A module may import anything above it and nothing below. No
cycles, no lateral imports inside a layer.

```
  L0  json.ts · enums/ · equal.ts               no internal imports
  L1  references/                    imports L0
  L2  env/                           imports L0-L1
  L3  resources/                     imports L0-L2
  L4  defaults/                      imports L0-L3
  L5  blueprint/                     imports L0-L3   (never defaults/)
  L6  validation/                    imports L0-L5   ← declares BlueprintInvalid
  L7  synth/                         imports L0-L6   ← the only importer of `yaml`
  L8  fs/                            imports L0, L6, L7   ← declares the two file errors
  L9  drift/                         imports L0, L6, L7, L8
  L10 index.ts                       imports L0-L9; re-exports only
  L11 cli/                           imports index.ts ONLY
```

- **Nothing imports `src/cli/`.** If a CLI file needs something `index.ts` does not export, export
  it — do not reach inside.
- **`src/synth/` is the only module that imports `yaml`.** No other file mentions YAML, quoting,
  indentation, or key order; `drift/` compares strings that `synth/` produced.
- **`src/fs/` is the only module that imports `node:fs`.** Everything above it is pure.
- **`src/index.ts` holds no logic** — re-exports only, so the public surface is one readable file.
- **`validation/rules/*` are pure functions returning `ValidationIssue[]`.** They never import each
  other and never short-circuit; `validate.ts` runs all of them and concatenates, because
  `BlueprintInvalid` must carry every problem at once.

### Deep modules

| Module | Surface | What it hides |
| --- | --- | --- |
| `synth/` | `synthesize(blueprint)` | YAML serialization entirely, key order, the generated-file header, the four disjoint schema branches, the `(type, runtime)` discriminator, the env map→list conversion, the keyless `fromGroup` entry, the `previewPlan`/`previews.plan` split, Postgres landing in `databases:` while Key Value lands in `services:`, read-replica name registration |
| `validation/` | `validate(blueprint)` | ~15 rule families, the traversal that reaches every reference in every env map on every resource in every placement, and the ordering that makes issue output deterministic |
| `references/` | property access on a resource value | both YAML reference forms, the `property` XOR `envVarKey` split, and the per-source legality table — nobody writes `fromDatabase`, they write `db.connectionString` |
| `defaults/` | `withDefaults(defaults)` | nesting and the kind × field matrix: region and plan never reach a static site; repo, branch, rootDir, autoDeployTrigger and buildFilter never reach Key Value or Postgres |
| `drift/` | `checkBlueprint(...)` | normalization of the committed file and the classification of changes to Render's immutable fields |

Shallow by design: `enums/`, `json.ts`, `blueprint/`, `cli/`.

## 4. Naming conventions

**Files.** kebab-case `.ts`, one primary export named after the file (`with-defaults.ts` →
`withDefaults`). Two exceptions, stated so they are not re-argued: a file may hold sibling
`as const` tuples differing only by resource kind (`enums/plan.ts`), and a factory file owns its
config and output interfaces — one contract, and splitting it buys an import, not a boundary.

**Factories.** camelCase, exactly as design B §2.3 names them: `web`, `privateService`, `worker`,
`cron`, `staticSite`, `keyValue`, `postgres`, `envGroup`, `blueprint`, `group`, `project`,
`environment`, `withDefaults`, `literal`, `secret`, `generated`, `readReplica`, and `external`.

**Types.** PascalCase, no `I` prefix, no `Type`/`Interface` suffix. Config and output never share
a name: `WebConfig` in, `WebService` out.

| Kind | Suffix | Examples | Why |
| --- | --- | --- | --- |
| Factory input | `Config` | `WebConfig`, `PostgresConfig` | Names the argument, matching the `(name, config)` signature the user reads. |
| Factory output | none — a domain noun | `WebService`, `Worker`, `CronJob`, `StaticSite`, `KeyValueStore`, `PostgresDatabase`, `EnvironmentGroup`, `ReadReplica` | The output is the thing itself; `WebServiceValue` is noise. |
| Reference handle | `Reference` | `PostgresReference`, `HttpServiceReference`, `OpaqueServiceReference` | Reads as "what you may reference on it". |
| Emitted reference | `ReferenceValue` | `DatabaseReferenceValue`, `ServiceReferenceValue` | Separates the emitted node from the handle that produces it. |
| Success payload | `Report` | `SynthesisReport`, `WriteReport`, `DriftReport` | Reports are not errors. |
| Caller knobs | `Options` | `WriteOptions`, `CheckOptions`, `LiteralOptions` | — |

**Tagged errors.** The class names the failed condition, **no `Error` suffix**, following
better-result's own `TemplateNotFound` / `RenderTemplateFailed`: `BlueprintInvalid`,
`BlueprintWriteFailed`, `BlueprintFileUnreadable`; `_tag` equals the class name. `ValidationCode`
literals use the same convention one level down — `DanglingReference`, `DuplicateResourceName`,
`ResourceInMultipleLocations`, `ScalingRangeInverted`, `HighAvailabilityUnsupported`,
`ExtraFieldConflict` — one literal per rule, named after the rule file that produces it.

**Enums.** `erasableSyntaxOnly` bans `enum`. Every closed set is a SCREAMING_SNAKE `as const`
tuple plus its derived union, in one file; the tuple is exported because validation and tests
iterate the set. INFERRED: the casing is a convention choice, so a value-level enum never reads
like a camelCase factory.

```ts
export const REGIONS = ["oregon", "frankfurt", "ohio", "singapore", "virginia"] as const;
export type Region = (typeof REGIONS)[number];
```

**YAML field names.** Emitted verbatim except the renames design B §2.6 fixes — the complete
list; a tenth needs an ADR.

| TS | YAML |
| --- | --- |
| `privateService(…)` | `type: pserv` |
| `staticSite(…)` | `type: web` + `runtime: static` |
| `keyValue(…)` | `type: keyvalue` |
| `env: { KEY: value }` | `envVars: [{ key, … }]` |
| `envGroups: [g]` | `envVars: [{ fromGroup }]` |
| `instances` | `numInstances` |
| `secret()` | `sync: false` |
| `previews.plan` / `previews.diskSizeGB` on Postgres and Key Value | `previewPlan` / `previewDiskSizeGB` |
| `extraFields` | merged into the mapping; not a Render field |

**Tests.** `describe` takes the exported symbol; `it` states the rule in the present indicative,
never "should" — `it("emits fromGroup entries after explicit env vars")`. INFERRED: no cited
document sets a test naming rule.

**Banned in every identifier: the substring `shape`,** case-insensitive
(`anti-slop/no-shape-in-symbol-names`). Where "shape" is the natural word — Render's four disjoint
service *shapes* — write `branch`, `form`, or `variant`.

## 5. Code doctrine

From `docs/research/better-result.md` §5 and the anti-slop rules, restated for this codebase.

**Result and errors**

- Only `synthesize`, `writeBlueprint`, `checkBlueprint` (public) and `validate`, `writeTextFile`,
  `readTextFile` (internal) return `Result`. Everything else is total — factories never fail, which
  is the point of ADR-0001's inert values. Never wrap a pure, total helper: a `validation/rules/*`
  function returns `readonly ValidationIssue[]`, where the empty array is success.
- `E` is always a union of `TaggedError` classes. Never `Result<T, string>`, `Result<T, Error>`, or
  `Result<T, unknown>`.
- **better-result §5 rule 1 is followed strictly: each error is declared beside the code that
  produces it, and there is no `src/errors/` directory.** `BlueprintInvalid` lives in
  `src/validation/blueprint-invalid.ts` — `validate` is its only producer; `synthesize`,
  `writeBlueprint` and `checkBlueprint` merely propagate it through `Result.gen`.
  `BlueprintWriteFailed` lives in `src/fs/write-text-file.ts` and `BlueprintFileUnreadable` in
  `src/fs/read-text-file.ts`, each at its own `Result.tryPromise` boundary. All three are public, so
  `src/index.ts` re-exports them; that re-export, not a shared directory, is the public vocabulary.
- `Result.gen` is required wherever two or more fallible steps compose: `writeBlueprint`
  (validate → synth → write) and `checkBlueprint` (validate → synth → read → compare). Async bodies
  use `Result.gen(async function* …)` with `yield* Result.await(p)`; `yield* await p` is banned.
  `synthesize` has one fallible step and uses `validate(bp).map(emit)`.
- `node:fs` throws. Wrap it in `src/fs/` with `Result.tryPromise` in the `{ try, catch }` object
  form so the boundary yields `BlueprintWriteFailed` / `BlueprintFileUnreadable`, never
  `UnhandledException` — the only translation site; no `node:fs` error type appears in a signature
  outside `src/fs/`.
- Every error carries `message: string` plus the fields a handler needs — `path` for the file
  errors, the non-empty `issues` list for `BlueprintInvalid` — and `cause: unknown` when it wraps.
  `cause` is the one parameter allowed to be `unknown`; handlers never parse `message`.
- Match only in `src/cli/`, always two-step: `result.match({ ok, err })`, then `error.match({ … })`.
  `unwrap()` is banned outside test setup, and there it carries an explanatory message.
- **`src/cli/main.ts` is the one and only `isPanic` boundary.** It reports the defect and rethrows.
  Converting a `Panic` into an `Err`, or catching one anywhere else, is forbidden. Callbacks given
  to `map` / `andThen` / `match` / `tap*` must not throw; a fallible step returns a `Result` and is
  chained with `andThen`.
- Import only from `"better-result"`, aliasing when a file needs both:
  `import { Result, type Result as ResultType } from "better-result";`

**Types**

- **Explicit return type on every exported function, explicit type on every exported const.**
  `isolatedDeclarations: true` is load-bearing — off, tsdown silently falls back to TS7's
  experimental declaration generator. Design B §8 priced this in.
- No `unknown` or `object` parameters, no `Record<string, unknown>`, no `any`. The escape hatch is
  `JsonObject` from `src/json.ts` — a concrete recursive union, so the dictionary rule holds with no
  assertion. Non-const assertions need a `SAFETY:` comment with real prose on the line above; expect
  roughly zero, and one in `synth/` means the emitter is wrong.
- No `typeof` narrowing for control flow. `EnvValue` discriminates on its own literal fields —
  `switch` on the discriminant. The one raw `string | number` shorthand is normalized into a
  `LiteralValue` once, at the edge of `resolve-env.ts`. No module mocking either: `src/fs/` is the
  seam, so tests pass an in-memory reader/writer.

**`exactOptionalPropertyTypes` and YAML emission**

- **Never emit a key whose value is `undefined`.** Omission means "retain current" on an existing
  Render resource (spec §12); an empty or null key silently rewrites an adopted resource. This is
  a correctness rule, not a cosmetic one. Equally, the library never injects a Render default —
  the emitter writes what the author wrote.
- `exactOptionalPropertyTypes` makes `{ plan: undefined }` unassignable to `{ plan?: ServerPlan }`,
  and `anti-slop/no-conditional-empty-object-spread` bans `...(cond ? { plan } : {})`. So the
  emitter never builds a mapping by object spread. `src/synth/mapping.ts` owns the one approved
  way: an ordered builder over `yaml`'s document model that appends a pair only when the value is
  not `undefined`, driven by the resource's field tuple and `key-order.ts`. Every mapping goes through it — no ad-hoc `doc.set`.

**Comments.** Few — the types and names carry the meaning. Only `SAFETY:` justifications and a
one-line spec citation where a rule looks arbitrary (`// spec §16 B`).

## 6. Testing strategy

**6.1 Unit tests, colocated.** `src/**/x.test.ts` beside `src/**/x.ts`. Assert the discriminated
Result, never an exception: narrow with `Result.isOk` / `Result.isError` before touching `.value` /
`.error`, assert variants with `BlueprintInvalid.is(result.error)` and `_tag`. Every tagged variant
a public signature promises gets a test. Highest-value targets: each `validation/rules/*` file (one
test per issue code plus its negative case), `synth/env-vars.ts` (all five env-var forms and
`fromGroup` ordering), `defaults/apply-defaults.ts` (the matrix, including fields that must *not*
propagate), `drift/normalize.ts`.

**6.2 The golden test.** `test/golden.test.ts` imports `test/fixtures/canonical/render.ts` — design
B §3 verbatim, the scenario every design document was judged on — calls `synthesize`, and compares
with `test/fixtures/canonical/render.yaml` via `toMatchFileSnapshot`. `vitest -u` regenerates it
and a human reviews the diff. This is the single regression net for key order, quoting, the header
and the map→list conversion, and the only file a test may rewrite.

**6.3 JSON Schema conformance.** `test/schema-conformance.test.ts` parses the golden YAML back with
`yaml.parse` and validates it against `test/schema/render.yaml.schema.json`. Validator: **ajv 8.x**
imported as `ajv/dist/2020` — the schema declares
`"$schema": "https://json-schema.org/draft/2020-12/schema"` and ajv 8's `2020` build is its draft
2020-12 entry point. **INFERRED**: `docs/research/toolchain.md` names no test-time validator (its
"schema library: none yet" line is about runtime parsing of untrusted input, which this is not) and
the draft-2020-12 claim is general knowledge, unverified here; confirm before committing, fallback
`@cfworker/json-schema`. The schema is the conformance *floor*, not the spec — requirements.md lists
nine rules it misses — so passing proves the output is not malformed while the unit tests prove it
is correct. `test/schema/render.yaml.schema.json` is the oracle and the only copy any code reads;
`docs/research/raw/render.yaml.schema.json` stays frozen as the 2026-09-05 snapshot.
`pnpm schema:refresh` runs `scripts/refresh-render-schema.mjs`, which downloads from the `$id` in
the file — `https://render.com/schema/render.yaml.json` — and overwrites the test copy only, as a
reviewed commit whose diff is the point. INFERRED: that `$id` is not confirmed to serve the schema
over HTTP.

**6.4 Type tests.** `src/**/x.test-d.ts`, run by `vitest --typecheck`, `@ts-expect-error` for
rejection and `expectTypeOf` for acceptance. **Every compile-time row of design B §5 gets one** —
rows 1-13 plus the compile half of row 21: wrong reference property per source kind, `disk` on a
cron job, `plan`/`region` on a static site, missing required `schedule`/`ipAllowList`, `secret()`
in an env group, `literal()` and `generated()` disjoint, `fromService` property XOR `envVarKey`,
the `renderVar` closed union, the `healthCheckPath` template literal, `runtime: "static"` on a
worker, `plan: "free"` on worker/pserv, `repo` with `runtime: "image"`, and listing a `ReadReplica`
or an `external.*` handle in `resources`. Also type-test the inferred error unions of the three
entry points: better-result §5 rule 18 asks for it and those unions are the public contract. Pin
vitest exactly; `--typecheck` is self-declared experimental. Rows 22 and 24 get no test — ADR-0001
accepts both, and no test may assert behaviour the library does not promise.

**6.5 CLI smoke test.** `test/cli.test.ts` spawns the built binary in a temp directory seeded from
`test/fixtures/cli/`, once per outcome: clean tree (exit 0), drifted `render.yaml` (exit 2),
invalid blueprint (exit 1). It asserts exit codes and that stderr names the resource, nothing about
formatting. ADR-0002 fixes the CLI's contract at exactly this. It builds the binary itself in
`beforeAll`, so it can never pass against a stale `dist/` and `pnpm check` stays self-contained.

**6.6 `pnpm check`** is the one command CI and agents run:
`oxfmt --check && oxlint && tsc -p tsconfig.check.json && vitest run && vitest run --typecheck`. Format first,
because it is instant and its failures are noise in every later diff.

## 7. Tooling files

Skeletons come from `docs/research/toolchain.md` lines 553-711 and are reused unmodified unless a
row says otherwise.

| File | Content |
| --- | --- |
| `tsconfig.json` | The skeleton verbatim: `target`/`lib` es2023, `module`/`moduleResolution` nodenext, `types: ["node"]`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, **`isolatedDeclarations`**, `erasableSyntaxOnly`, `declaration` + `declarationMap` + `sourceMap`, `outDir: "dist"`, `rootDir: "src"`, `skipLibCheck`, `include: ["src"]`. The two UNSURE options (`allowImportingTsExtensions`, `composite`) stay out. |
| `.oxlintrc.json` | The skeleton verbatim: `plugins: ["typescript","unicorn","oxc"]`, `categories.correctness: "error"`, `ignorePatterns` for `.agents/**`, `.claude/**`, `.reference/**`, `dist/**`, `tools/oxlint/anti-slop/**`, the `jsPlugins` entry pointing at `./tools/oxlint/anti-slop/index.ts`, and all 15 `anti-slop/*` rules at `"error"`. `anti-slop-effect` stays omitted — no direct `effect` dependency. Add `test/fixtures/**`: the fixture `render.ts` is user-style code, not library code. |
| `.oxfmtrc.json` | The skeleton verbatim: `printWidth` 100, `tabWidth` 2, `semi`, double quotes, `trailingComma: "all"`, `sortImports: true`, `sortPackageJson: true`, `ignorePatterns` for `.reference/**`, `dist/**`, `tools/oxlint/anti-slop/**`. |
| `vitest.config.ts` | `test.include: ["src/**/*.test.ts","test/**/*.test.ts"]`, `test.typecheck.include: ["src/**/*.test-d.ts"]`, `test.typecheck.tsconfig: "tsconfig.json"`. INFERRED — the toolchain doc verifies vitest 5 with `--typecheck` but ships no config skeleton. |
| `tsdown.config.ts` | `entry: { index: "src/index.ts", testing: "src/testing.ts", cli: "src/cli/main.ts" }`, `format: "esm"`, `fixedExtension: false`, `dts: true`, `deps: { neverBundle: ["yaml", "better-result"] }`, shebang on the `cli` entry. `fixedExtension: false` is required: tsdown 0.23 defaults it to true on the node platform and emits `.mjs` and `.d.mts`, which `exports`, `bin`, and CI would not find (verified in PR #15). `neverBundle` is mandatory — the default bundles dependencies and the toolchain doc measured 234 kB of `yaml` inlined. `better-result` in that list is INFERRED but forced: its types appear in the public signatures. |
| `.github/workflows/ci.yml` | `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`. INFERRED. |
| `.gitignore` | Unchanged; already covers `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.reference/`. |

```jsonc
{
  "name": "render-blueprint",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./testing": { "types": "./dist/testing.d.ts", "default": "./dist/testing.js" }
  },
  "bin": { "render-blueprint": "./dist/cli.js" },
  "files": ["dist"],
  "engines": { "node": ">=22.12.0" },
  "devEngines": { "runtime": { "name": "node", "version": "^22.18.0 || ^24.11.0 || >=26.0.0" } },
  "packageManager": "pnpm@10.33.4",
  "dependencies": { "better-result": "3.0.1", "yaml": "2.9.0" },
  "devDependencies": { "@oxlint/plugins": "1.81.0", "@types/node": "26.4.1", "ajv": "8.x",
    "oxfmt": "0.66.0", "oxlint": "1.81.0", "tsdown": "0.23.0", "typescript": "7.0.2",
    "vitest": "5.0.0" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "test": "vitest run",
    "test:types": "vitest run --typecheck",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:types",
    "build": "tsdown",
    "schema:refresh": "node scripts/refresh-render-schema.mjs"
  }
}
```

One export path — deep imports into `dist/` are what an `index.ts`-only surface avoids. Every
dependency is pinned exactly except `ajv` (INFERRED, not yet chosen); `oxlint` and `@oxlint/plugins`
must stay equal, and vitest exact because `--typecheck` is experimental.

## 8. Not settled here

Design B §9's nine open decisions stay open; none changes the layout. The three that touch code
soonest: `fromGroup` emission order (§9.2 — `key-order.ts` picks one, the golden test freezes it),
whether `KeyValueReference.host`/`.port` survive (§9.3), and `withDefaults` conflict semantics
(§9.6 — one branch in `apply-defaults.ts`).

---

## Codebase conventions

*Promote this block into `CLAUDE.md` when phase 2 closes.*

- One package. The CLI is a `bin` entry in it, never a second package.
- `src/index.ts` is the only public entry and holds re-exports only. Add an export there rather
  than importing across a boundary that does not exist.
- Imports flow strictly upward: `json`/`enums` → `references` → `env` → `resources` →
  `defaults`/`blueprint` → `validation` → `synth` → `fs` → `drift` → `index.ts` → `cli`. No cycles,
  no lateral imports. Nothing imports `src/cli/`; `src/cli/` imports `src/index.ts` and nothing
  else in `src/`. `src/synth/` is the only module that imports `yaml`; `src/fs/` the only one that
  imports `node:fs`.
- Files are kebab-case with one primary export named after the file. Runtime tests are `x.test.ts`
  beside `x.ts`; type tests are `x.test-d.ts` beside `x.ts`. Cross-module tests and fixtures live
  in `test/`.
- Factories are camelCase (`web`, `privateService`, `keyValue`, `withDefaults`, `secret`). Factory
  input types end in `Config`, factory output types are bare domain nouns — `WebConfig` in,
  `WebService` out. Reference handles end in `Reference`, emitted reference nodes in
  `ReferenceValue`. No `I` prefix, no `Type`/`Interface` suffix.
- Tagged error classes name the failed condition with no `Error` suffix: `BlueprintInvalid`,
  `BlueprintWriteFailed`, `BlueprintFileUnreadable`. `ValidationCode` literals follow the same
  rule, one per rule file.
- Declare a tagged error in the file that produces it, never in a shared errors directory:
  `BlueprintInvalid` in `src/validation/blueprint-invalid.ts`, `BlueprintWriteFailed` in
  `src/fs/write-text-file.ts`, `BlueprintFileUnreadable` in `src/fs/read-text-file.ts`. All three
  are re-exported from `src/index.ts`. Do not create `src/errors/`.
- No identifier may contain the substring `shape`, in any casing. Say `branch`, `form`, `variant`.
- No `enum`. A closed set is a SCREAMING_SNAKE `as const` tuple plus a derived `(typeof T)[number]`
  union in the same file.
- Emit Render's field names verbatim. The only renames are the nine in `docs/design/structure.md`
  §4; a tenth needs an ADR. Never inject a Render default — emit what the author wrote.
- Every exported function has an explicit return type and every exported const an explicit type.
  `isolatedDeclarations` is load-bearing — never turn it off to make something compile.
- Only `synthesize`, `writeBlueprint`, `checkBlueprint`, `validate`, `writeTextFile` and
  `readTextFile` return `Result`. Factories are total. Never wrap a pure, total helper in `Result`.
- `E` is always a union of `TaggedError` classes. Never `Result<T, string>`, `Result<T, Error>`,
  or `Result<T, unknown>`.
- Use `Result.gen` whenever two or more fallible steps compose. Async: `Result.gen(async
  function* …)` with `yield* Result.await(p)`. `yield* await p` is banned.
- Wrap throwing Node APIs at `src/fs/` with `Result.tryPromise` in the `{ try, catch }` object
  form. No `node:fs` error type appears in a signature outside `src/fs/`.
- `src/cli/main.ts` is the only `isPanic` site: report, then rethrow. Never convert a `Panic` into
  an `Err`. Never `unwrap()` outside test setup. Match only in `src/cli/`, two-step:
  `result.match({ ok, err })` then `error.match({ … })`.
- `BlueprintInvalid` carries every issue, not the first. Rule functions in `src/validation/rules/`
  are pure, return `readonly ValidationIssue[]`, and never short-circuit.
- Never emit a YAML key whose value is `undefined` — omission means "retain current" on Render.
  Build every mapping through `src/synth/mapping.ts`: no object spread, no ad-hoc `doc.set`, no
  `...(cond ? { k } : {})`.
- No `unknown` or `object` parameters (`cause` excepted), no `Record<string, unknown>`, no `any`.
  The escape hatch is `JsonObject` from `src/json.ts`. Every non-const assertion carries a
  `SAFETY:` comment with real prose on the line above.
- No `typeof` narrowing for control flow — discriminate on the union's own literal fields. No
  module mocking; `src/fs/` is the test seam, so pass an in-memory reader/writer.
- Few comments: only `SAFETY:` justifications and one-line spec citations (`// spec §16 B`).
- Tests assert the discriminated Result: narrow with `Result.isOk` / `Result.isError`, assert
  variants with `SomeError.is(...)` and `_tag`. Never assert on a thrown exception. `describe`
  names the exported symbol; `it` states the rule in the present indicative, never "should".
- Every compile-time row of design B's mistake matrix has a `*.test-d.ts` case using
  `@ts-expect-error`. Adding a compile-time guarantee means adding its type test.
- `test/fixtures/canonical/render.yaml` is the golden file and the only file a test may rewrite
  (`vitest -u`). Review its diff by hand. `test/schema/render.yaml.schema.json` is the conformance
  oracle; refresh it with `pnpm schema:refresh`, never by hand, and never read
  `docs/research/raw/` from code.
- Run `pnpm check` before claiming done: format, lint, typecheck, tests, type tests.
- `tools/oxlint/anti-slop/` is vendored output. Never edit it, never lint it, never weaken a rule
  to make lint pass — fix the code. Re-vendor with the `install-anti-slop` skill.
