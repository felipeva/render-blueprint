# Context — the ubiquitous language of `render-blueprint`

Use these words. Definitions come from `docs/design/structure.md`,
`docs/design/alternatives/b-factories-typed-refs.md` §2, and `docs/research/render-blueprint-spec.md`.

## Core

- **Blueprint** — the single explicit root value, built by `blueprint({ resources, projects, ungrouped, previews })`. It is total: it never validates and never fails. `src/blueprint/blueprint.ts`.
- **Resource** — an inert value returned by a factory, carrying a `kind` discriminator, a `name`, and its reference handle. The `BlueprintResource` union is what `resources: [...]` accepts. `src/resources/resource.ts`.
- **Resource kind** — one of the eight listable kinds: **web service** (`web`), **private service** (`privateService`, emitted `type: pserv`), **worker** (`worker`), **cron job** (`cron`), **static site** (`staticSite`, emitted `type: web` + `runtime: static`), **key value store** (`keyValue`), **Postgres database** (`postgres`, emitted under `databases:`), **environment group** (`envGroup`). One file each in `src/resources/`.
- **Read replica** — a Postgres replica declared with `readReplica(name)`. It is referenceable but deliberately outside `BlueprintResource`, so listing it in `resources` is a type error. `src/resources/read-replica.ts`.
- **Factory** — a lowercase `(name, config)` function returning a resource with no construction side effects. Factories are total; only `validate`, `synthesize`, `writeBlueprint` and `checkBlueprint` return `Result`.
- **Config** — a factory's input type, always suffixed `Config` (`WebConfig`, `PostgresConfig`).
- **Output value** — a factory's output type, a bare domain noun (`WebService`, `KeyValueStore`). Never suffixed.
- **Defaults provenance** — the optional field the seven kinds a scope can fill carry: which defaults scopes created the resource, which of their declared defaults the resource's kind and source branch can take at all, and which landed, each attributed to the scope that declared it. `DefaultsProvenance`. A bare factory never sets it and it never reaches YAML; the unused-default rule reads it, and a config issue on a field a scope filled says so. `src/resources/defaults-provenance.ts`.
- **Unused default** — a default a scope declares that applies to nothing: no resource created through it, or through a scope nested inside it, has the field. A value a resource or an inner scope overrode still applies, so it is not unused. `src/validation/rules/unused-default.ts`.

## References

- **Reference handle** — the interface a resource exposes so others can reach for a reference as a property: `PostgresReference`, `KeyValueReference`, `HttpServiceReference`, `OpaqueServiceReference`. `src/references/`.
- **Reference value** — the inert node a handle produces, mapping 1:1 onto a YAML reference form: `DatabaseReferenceValue` (`fromDatabase`) and `ServiceReferenceValue` (`fromService`, `property` XOR `envVarKey`). `src/references/reference-value.ts`.
- **Reference origin** — the literal every reference value carries saying whether its target is declared here or reached through an external handle: `ReferenceOrigin`, `blueprint` or `external`. It never reaches YAML; the dangling-reference rule reads it to know which references it can resolve at all. `src/references/reference-origin.ts`.
- **External handle** — `external.web(name)`, `external.postgres(name)` and the rest: a handle for a resource outside this blueprint. It carries no `kind`, so it cannot be listed as a resource. `src/references/external.ts`.
- **Registry credential** — `external.registryCredential(name)`, the handle naming a credential the workspace holds; it is never defined in `render.yaml`. A prebuilt image names it through `image.creds` and a Dockerfile build through `registryCredential`; a native source takes none. `src/references/registry-credential-reference.ts`.
- **Self-reference** — the `env: (self) => ({ ... })` callback form, where `self` is the enclosing resource's own handle. No mutation and no cycle.

## Environment variables

- **Env value** — anything assignable to a key in an environment map: a string, a number, one of the three sentinels, or a reference value. `src/env/env-value.ts`.
- **Literal** — `literal(value, options?)`, the sentinel carrying a plain value plus an optional `previewValue`. `src/env/literal.ts`.
- **Secret** — `secret()`, the sentinel emitted as `sync: false`. `src/env/secret.ts`.
- **Generated** — `generated()`, the sentinel emitted as `generateValue: true`. `src/env/generated.ts`.
- **Environment map** — the `env: { KEY: value }` object form. Synth converts it to Render's `envVars:` list. `src/env/resolve-env.ts`.
- **Environment group** — a named bag of env values, referenced by a resource through `envGroups: [g]` and emitted as a keyless `fromGroup` entry. Groups accept no `secret()` and no references.

## Placement and defaults

- **Defaults scope** — `withDefaults(defaults)`, a nestable set of factories preloaded with `region`, `repo`, `branch`, `rootDir` and per-kind `plan`. Defaults are matrix-filtered per kind, and a per-resource value always wins. `src/defaults/`.
- **Placement** — where a resource is declared: **root** (`resources`), **project** / **environment** (`projects[].environments[]`), or **ungrouped**. A resource belongs to exactly one placement; two is a validation issue. `src/blueprint/placement.ts`.

## Validation and synthesis

- **Validation issue** — one problem found by a rule: a `code`, a `ResourcePath` (`{ resource, field }`), and a message. `src/validation/issue.ts`.
- **Validation code** — the literal naming the rule that produced an issue (`DanglingReference`, `DuplicateResourceName`, `ScalingRangeInverted`), one per file in `src/validation/rules/`.
- **Validation warning** — a non-blocking finding carried on a successful synthesis report, never in an error.
- **BlueprintInvalid** — the tagged error `validate` produces, carrying a non-empty list of every issue found, never the first one only. Declared in `src/validation/blueprint-invalid.ts` and re-exported from `src/index.ts`.
- **Synthesize** — `synthesize(blueprint)`: validate, build the YAML document, emit. The only code path that knows YAML exists. `src/synth/`.
- **Synthesis report** — the success payload of `synthesize`: the `yaml` string plus the warnings.
- **Emission order** — the fixed key order per node kind that makes output byte-stable. Each resource declares its ordered field tuple beside its factory; `src/synth/key-order.ts` holds only the root and env entry orders.
- **Golden file** — `test/fixtures/canonical/render.yaml`, the byte-equal expectation for the canonical scenario and the only file a test may rewrite (`vitest -u`).

## Drift

- **Drift** — a difference between the committed `render.yaml` and what `synthesize` produces now. Drift is an outcome, not an error. It is judged after normalization, so it is semantic equivalence and not byte equality: a clean check does not mean `writeBlueprint` would leave the file untouched, because a reordered or reflowed file says the same thing and still compares clean.
- **Drift report** — what `checkBlueprint` returns: `{ status: "clean", warnings }` or `{ status: "drift", diff, immutableFieldChanges, parseErrors, warnings }`. `warnings` are the synthesis warnings, carried on both variants so a strict CI run fails on them without synthesizing twice. `parseErrors` says why the committed file could not be read as YAML, and is empty when it parsed. `src/drift/`.
- **Immutable field** — a field Render cannot change in place (`type`, `runtime`, `region`, a database's `name`/`user`/`databaseName`/`postgresMajorVersion`). Changes to one are classified separately in the drift report. `src/drift/immutable-field.ts`.

## Escape hatches

- **Escape hatch** — `extraFields`, a `JsonObject` merged into a mapping for a Render field the library does not model. `JsonObject` is the concrete recursive union in `src/json.ts`; it replaces `Record<string, unknown>` everywhere.
- **Rename table** — the nine TS→YAML renames. `docs/design/structure.md` §4 is the single copy; a tenth needs an ADR. Do not restate them here.

## Words we do not use

- **`shape`** — banned in every identifier, any casing (`anti-slop/no-shape-in-symbol-names`). Say **branch**, **form**, or **variant**.
- **`Error` suffix** on a tagged error class. The class names the failed condition: `BlueprintInvalid`, not `BlueprintInvalidError`.
- **`Options`** for a factory input. Factory inputs are `Config`; `Options` is reserved for caller knobs (`WriteOptions`, `CheckOptions`).
- **`Output` / `Value` suffix** on a factory output. It is `WebService`, not `WebServiceValue` or `WebOutput`.
