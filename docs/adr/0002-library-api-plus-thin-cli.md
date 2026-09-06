# ADR-0002: Library functions are primary; a thin CLI maps Results to exit codes

Status: accepted
Date: 2026-09-05

## Context

The blueprint must be synthesized to `render.yaml` and checked for drift in CI. The
alternatives were: library functions only, with the user's `render.ts` as the entry point;
a CLI binary as the primary interface; or both.

## Decision

The library exposes `writeBlueprint` and `checkBlueprint` (final names in
`docs/design/structure.md`) returning `Result` values. A thin CLI binary discovers `render.ts`
by walking up from the working directory, imports it through Node's native type stripping,
calls the library, and maps the outcome to exit codes: 0 clean, 1 invalid or failed, 2 drift.

The CLI owns no logic beyond discovery, loading, and exit-code mapping.

## Consequences

- The user's `render.ts` must use erasable TypeScript syntax only, because Node strips types
  without type-checking. Enums, namespaces, and parameter properties are not allowed there.
- The consumer Node floor is at least the version where type stripping is unflagged.
  `docs/research/toolchain.md` records the exact floor.
- Tests exercise the library functions directly; the CLI gets a smoke test.
