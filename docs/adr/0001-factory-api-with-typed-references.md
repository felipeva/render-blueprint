# ADR-0001: Factory functions returning inert values with typed references

Status: accepted
Date: 2026-09-05

## Context

Four interface designs were produced for the same canonical scenario and compared in
`docs/design/alternatives/` against `docs/design/requirements.md`: a YAML-mirror data model
(A), factory functions with typed reference handles (B), type-state fluent builders (C), and
a CDK-style construct model (D).

The deciding criteria were cross-file composition in a monorepo, diagnostic quality on a
plain config object, and friction with `isolatedDeclarations` under TypeScript 7. A loses
reference checking silently when a fragment is annotated the wrong way. C forces hand-written
stage types on every exported builder and produces unreadable errors outside hand-poisoned
cases. D registers resources implicitly, so no single expression says whether a resource is in
the output.

## Decision

Design B is the backbone.

- One lowercase factory per resource kind, `(name, config)`, returning an inert value with no
  construction side effects.
- The returned value's properties are the cross-resource references, with a distinct handle
  interface per source kind so only legal `property` values exist.
- Self-reference through the `env: (self) => ({ ... })` callback form.
- Out-of-blueprint resources through `external.*` handles, string-named by design.
- A `withDefaults(...)` scope for `region`, `repo`, `branch`, and per-kind `plan`.
- A single explicit `blueprint({ resources: [...] })` root. Factories never fail; only synth,
  write, and check return `Result`.
- Leaf modules in a monorepo export a function of their dependencies, not a bare resource.

Three elements are borrowed from the other designs:

- From C: `diskSizeGB` typed as the literal union of allowed sizes.
- From D: a synth error when a group import and a direct env value collide on one key.
- From D: no env merge is ever last-write-wins; duplicates are a synth error.

Names are user-chosen literals and emitted verbatim. The duplication between the variable
name and the name string is accepted.

## Consequences

- A resource that is declared, never referenced, and never listed is not caught by the
  library. The committed `render.yaml` diff and the CI check are the safety net. An oxlint
  rule is a later ticket.
- References to workspace-only resources are unverifiable offline and pass through to Render.
- Structural, enum, and presence rules are compile-time. Relational, numeric-range, and
  cross-resource rules are synth-time. Anything needing workspace state passes through.
- Tagged errors are declared beside their producer and re-exported from `src/index.ts`; there is
  no shared errors directory.
- Row 8 of design B's mistake matrix — a `fromService` node carrying both `property` and
  `envVarKey` — holds through the handles, which yield one or the other, and at runtime, where
  both branches of the value schema are strict. It does not hold for an object literal annotated
  with `ServiceReferenceValue`: TypeScript admits any property declared by any member of a union
  target, so the pair is unrepresentable through the API rather than in the type.
