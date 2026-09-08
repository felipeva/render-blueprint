# Contributing

`render-blueprint` turns typed TypeScript factories into `render.yaml`. It never calls the Render
API, so the whole library is a pure function from a value to a string, and almost every change is
local to one module.

This page is the map: it says which files a change touches and which tests must agree with it. It
links to the rules rather than restating them, so there is one copy of each.

- `CONTEXT.md` — the glossary. Read it first; the words below are defined there.
- `AGENTS.md` — the conventions in force. `CLAUDE.md` is a symlink to it.
- `docs/adr/` — the three decisions everything else follows from.
- `docs/design/structure.md` — §2 is the tree, §3 is the dependency policy, §6 is the test
  strategy. It also says _why_ each convention exists.

## Set up, and the one gate

```sh
pnpm install
git config core.hooksPath .githooks   # once per clone; git does not version hooks
pnpm check                            # format, lint, typecheck, tests, type tests
pnpm build                            # the bundle, the types and the bin, into dist/
```

`pnpm check` is the gate. Judge it by its exit code, never by a summary line it printed. `pnpm
build` is the second gate for anything that touches a published export: it runs
`scripts/check-declarations.mjs`, which fails if a Zod type reached `dist/index.d.ts`.

The `pre-commit` hook formats and lints the files you staged, so stage whole files. The
`commit-msg` hook validates the Conventional Commits subject.

## Where things live

Modules import strictly upward, and `docs/design/structure.md` §3 is the enforceable version of
this list:

`raise` `equal` → `json` `bounded-integer` `enums/` → `references/` → `env/` → `resources/` →
`defaults/` `blueprint/` → `validation/` → `synth/` → `fs/` → `drift/` → `index.ts` `testing.ts` →
`cli/`

`synth/` is the only module that knows YAML exists, `fs/` the only one that touches the disk, and
`cli/` reaches the library only through `index.ts`.

## What to change, and what must agree with it

| Task                                                        | Edit these                                                                                                                                                                                                                                                                                                                                                                                                    | Then run these                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add or change a field on one resource kind                  | `src/resources/<kind>.ts` — the public interface, the private schema, and the `<KIND>_FIELDS` tuple — then that kind's emitter in `src/synth/`, named for what it emits rather than for the factory: `web-service.ts`, `private-service.ts`, `worker-service.ts`, `cron-job.ts`, `static-site.ts`, `key-value-store.ts`. Postgres emits from `databases.ts` and an environment group from `env-var-groups.ts` | `src/resources/<kind>.test.ts`, `src/resources/<kind>.test-d.ts`, `test/key-order-conformance.test.ts`, `test/fixtures.test.ts`                       |
| Add a sub-config that several kinds spread                  | `src/resources/<name>.ts` and its emitter in `src/synth/`, again named for the node it writes — `resources/previews.ts` emits from `synth/service-previews.ts`                                                                                                                                                                                                                                                | the same, plus the tests of every kind that spreads it                                                                                                |
| Add a resource kind                                         | `src/resources/<kind>.ts`, the union and `RESOURCE_KINDS` in `src/resources/resource.ts`, the three `switch` blocks and `RESOURCE_KINDS` in `src/validation/parse-resource.ts`, the new emitter in `src/synth/`, the dispatch in `src/synth/services.ts`, the matrix in `src/defaults/apply-defaults.ts`, and `src/index.ts`                                                                                  | the new kind's tests, `test/fixtures.test.ts`, `test/enum-conformance.test.ts`                                                                        |
| Change what YAML comes out, or in what order                | the `_FIELDS` tuple beside the factory, then that kind's emitter in `src/synth/`, named for the kind it emits. `src/synth/key-order.ts` only for the orders no resource owns: the root, the placement axes, the env-var entry forms and the registry-credential nodes                                                                                                                                         | `test/fixtures.test.ts`, `test/key-order-conformance.test.ts`, `src/synth/*.test.ts`                                                                  |
| Add a rule that spans resources                             | `src/validation/rules/<code>.ts`, its literal in `src/validation/issue.ts`, its call in `src/validation/validate.ts`                                                                                                                                                                                                                                                                                          | `src/validation/rules/<code>.test.ts`, `src/validation/validate.test.ts`                                                                              |
| Add a rule about one config's own values                    | a refinement in that factory's private schema, raised through `raise(ctx, 'Code', …)` so it keeps its own code                                                                                                                                                                                                                                                                                                | the factory's `.test.ts`, through `test/support/raised-issues.ts`                                                                                     |
| Change a diagnostic's code, message or field path           | `src/validation/translate-schema-issue.ts`, `src/validation/describe-names.ts`, `src/validation/issue.ts`                                                                                                                                                                                                                                                                                                     | `src/validation/*.test.ts`, `src/cli/format.test.ts`, `test/cli.test.ts`                                                                              |
| Add or change a default                                     | `DEFAULT_FIELDS` in `src/resources/defaults-provenance.ts`, then `src/defaults/resource-defaults.ts`, `apply-defaults.ts` and `defaults-scope.ts`                                                                                                                                                                                                                                                             | `src/defaults/*.test.ts`, `src/validation/rules/unused-default.test.ts`, `test/fixtures/defaults-scope/`                                              |
| Change CLI output, a flag, or an exit code                  | `src/cli/commands.ts` for flags, `execute.ts` for what runs, `report.ts` for the streams and the exit codes, `format.ts` for the text                                                                                                                                                                                                                                                                         | `src/cli/*.test.ts`, `test/cli.test.ts`                                                                                                               |
| Change how drift is judged                                  | `src/drift/normalize.ts`, `diff.ts`, `immutable-field.ts`                                                                                                                                                                                                                                                                                                                                                     | `src/drift/*.test.ts`, `test/cli.test.ts`                                                                                                             |
| Change how a file is read or written                        | `src/fs/`; `file-port.ts` is the seam                                                                                                                                                                                                                                                                                                                                                                         | `src/fs/*.test.ts`. Never mock a module — pass `memoryFilePort`                                                                                       |
| Add a public export                                         | `src/index.ts`, or `src/testing.ts` for a test-only helper. Both hold re-exports and nothing else                                                                                                                                                                                                                                                                                                             | `src/index.test-d.ts`, then `pnpm build`                                                                                                              |
| Add a helper the integration suites share, or a new fixture | `test/support/` for the helper; `test/fixtures/<name>/render.ts` for the fixture                                                                                                                                                                                                                                                                                                                              | `test/fixtures.test.ts` finds any directory holding a `render.ts`, so there is nothing to wire up. Create the expectation with `pnpm fixtures:update` |

## Six rules that catch people out

Each is one bullet under _Codebase conventions_ in [`AGENTS.md`](AGENTS.md), which is where the rule
is actually stated. This list is only so you know which bullet to go and read.

- **Never emit a key whose value is `undefined`** — omission means "retain current" on Render.
- **Explicit return type on every exported function, explicit type on every exported const.**
- **A config's schema stays private to its factory's file** — see also ADR-0003.
- **Factories are total** — six functions return a `Result`, and nothing else does.
- **`src/cli/main.ts` is the only place a panic is classified.**
- **No identifier contains the substring `shape`,** in any casing.

## Fixtures and the golden file

`test/fixtures/*/render.yaml` and the two `test/fixtures/cli/*/expected.yaml` are committed
expectations compared byte for byte, `pnpm fixtures:update` is the only thing that may rewrite them,
and `test/schema/render.yaml.schema.json` is the conformance oracle that `pnpm schema:refresh`
refreshes — all three stated in full in the last two bullets of [`AGENTS.md`](AGENTS.md). The part
worth repeating: a fixture diff you did not intend is a bug you have just found, not an expectation
to accept.

## Opening a change

Anything with a design decision behind it starts as an issue, not as a branch —
`AGENTS.md` has the sequence. A docs correction, a formatting pass or CI plumbing can go straight
to a branch.

Branch as `<type>/<issue>-<slug>`, for example `feat/12-env-values`, where `<type>` is the
Conventional Commits type the work lands under, so the branch, the commits and the pull request
title all agree. Commit subjects are lowercase imperative, at most 72 characters, with a body that
says why. Open the pull request against `main` and let a human merge it.
