# Requirements — Render Blueprint IaC in TypeScript

Phase 1 input. Gathered from `docs/research/*` on 2026-09-05. Every design alternative in
`docs/design/alternatives/` is judged against this file, not against taste.

## Problem

Developers hand-edit `render.yaml`. The file joins resources by bare string names, has four
disjoint service shapes hidden behind one `services:` list, five env var shapes, and a JSON
Schema that is looser than the prose rules Render actually enforces at sync time. A rename or
a typo is a silent broken deploy. The library lets a developer describe the same resources in
TypeScript with typed cross-resource references, then synthesizes a `render.yaml` that Render
owns from then on.

The library is a generator. It never calls the Render API, never diffs against live state, and
keeps no state file. The emitted file is the state.

## Callers

1. **Application developers** writing one blueprint file per repo, sometimes composed from
   per-app files in a monorepo (`apps/api/render.ts` exports a service; the root assembles).
2. **CI** running a drift check: regenerate, compare with the committed `render.yaml`, fail on
   difference.
3. **The library's own tests**, which need resources to be inert values and synth to be pure.
4. **A future importer** (`render.yaml` to TS). Out of scope for v1; the design must not make
   it impossible.

## Key operations

- Declare services: web, worker, private service (`pserv`), cron, static site, key value.
- Declare Postgres databases with read replicas, high availability, IP allow lists.
- Declare env var groups, root `previews`, and `projects[].environments[]`.
- Choose a source per service: repo plus branch, Dockerfile, or prebuilt image.
- Set disks, scaling and autoscaling, domains, static headers and routes, build filters.
- Declare env vars in all five shapes: literal, secret (`sync: false`), generated,
  `fromDatabase`, `fromService` (by `property` or by `envVarKey`), `fromGroup`.
- Reference a resource in the same blueprint, the service itself, or a resource that exists
  only in the Render workspace.
- Override per-preview settings.
- Synthesize to a YAML string and to a file. Validate and report every error at once.
- Pass through fields the library does not model yet.

## Platform facts the design must honour

From `docs/research/render-blueprint-spec.md`.

- Service identity is the pair `(type, runtime)`. A static site is `type: web` plus
  `runtime: static`. The schema's four service shapes have disjoint field sets (§0, §4.8).
- Every cross-resource link is a bare name. The referent only has to exist in the workspace.
  Self-reference is allowed. Registry credentials can never be declared in the file (§12).
- Names are user-visible, become hostnames, and are the adoption key. They are emitted
  verbatim; the library never derives or hashes them.
- Env vars merge additively on sync; `buildFilter` and `readReplicas` replace destructively
  when omitted (§12). Defaults the generator emits must respect this.
- The schema does not enforce: env var shape exclusivity, `fromService` property XOR
  envVarKey, scaling min ≤ max, cron schedule, keyvalue ipAllowList, static site without
  plan/region, healthCheckPath leading slash, diskSizeGB rule (§16 B). The library enforces
  the prose.
- Seven prose rules the library enforces beyond the schema, each at the rung the prose earns
  it. Issues: a cron `schedule` that is not a five-field cron expression (§4.1), an
  `ipAllowList` `source` that is neither an address nor a CIDR range (§7), a `diskSizeGB` that
  is neither 1 GB nor a multiple of 5 GB (§9), and high availability on a Postgres database
  below version 13 or on a plan with less than 1 CPU (§9). Warnings: an `autoDeployTrigger` on
  a service that deploys a prebuilt image (§4.3), a `previewValue` on a worker or a cron job
  (the preview-environments page), and a persistence mode other than `off` on a free Key Value
  instance (§5).
- Deprecated forms are never emitted: `env`, `autoDeploy`, `previewsEnabled`,
  `pullRequestPreviewsEnabled`, service `previewPlan`, `type: redis` (§13).
- The published JSON Schema (`docs/research/raw/render.yaml.schema.json`) is the conformance
  floor for emitted output and a test oracle.

## Engineering constraints

From `docs/research/toolchain.md` and `docs/research/better-result.md`.

- TypeScript 7.0.2, ESM only, `isolatedDeclarations: true`: every exported symbol carries an
  explicit type annotation. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` on.
- better-result everywhere something can fail: `synth` and `validate` return
  `Result<T, E>` with `E` a union of `TaggedError` classes. Nothing in the public API throws.
  Constructors and factories cannot fail; failures are collected and reported at synth.
- anti-slop: no `unknown` or `object` parameters, no `Record<string, unknown>`, no "shape"
  in identifiers, every non-const assertion carries a `SAFETY:` comment, no module mocking.
- Few comments. The types and names carry the meaning.
- Emit Render's own field names by default. Rename only where the YAML name is actively bad.

## Exposed vs hidden

Exposed: resource declarations, typed references, secret helpers, preview overrides, the
synth and check entry points, the error types, the escape hatch.

Hidden: YAML emission and key ordering, the map-to-list conversion for env vars, the
`(type, runtime)` discrimination, deprecated-field mapping to current forms, schema
conformance, the generated-file header, name deduplication, reference resolution.

## Evaluation criteria for the alternatives

From the design-an-interface skill, plus what this domain adds.

1. **Interface simplicity.** Count of exported symbols a user must learn for the common case.
2. **Depth.** How much of the hidden list each design actually hides behind a small surface.
3. **Compile-time catch rate.** Share of the mistake matrix caught before synth.
4. **Error quality.** Whether a compile error or a synth error names the resource and field.
5. **Cross-file composition.** Whether an exported resource keeps its reference typing.
6. **Name duplication and forgotten resources.** How each design handles the two known
   failure modes of explicit registration.
7. **Discoverability.** What autocomplete offers at each step.
8. **Toolchain friction.** `isolatedDeclarations` cost, type complexity, inference load.
9. **Ease of misuse.** Which mistakes look correct and pass through to Render.
10. **Importer compatibility.** Whether `render.yaml` to TS could target this surface later.

## Non-goals for v1

Render API calls, live diffing, a state file, an importer, secret files, registry credential
declaration, variable interpolation.
