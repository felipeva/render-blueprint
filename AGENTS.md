## Project

`render-blueprint` is a TypeScript library of factories that describe Render.com resources and
synthesize them to `render.yaml`. Generator only: it never calls the Render API. The npm package
and the CLI binary are both named `render-blueprint`. Phases 1 to 4 are done: the spec is issue #1; the tickets #2 to #14 plus #17, #20, #22, and the
bug #31 all landed as squash-merged PRs on `main` (last: #35 on 2026-09-06). v1.1 (spec #39, tickets
#40 to #45, bugs #36 to #38) landed the same way, last #54 on 2026-09-07. An adversarial review against the raw spec and schema on 2026-09-07 produced
bugs #57 to #62, landed as PRs #63 to #68 the same day; its two medium findings (cross-field rules
suppressed by a type failure, `extraFields` against the schema's per-kind allow-lists) await a v1.2
spec. New work starts with
`/to-spec` for a feature or a plain `ready-for-agent` issue for a bug, then a Herdr dispatch.

- `CONTEXT.md` — the glossary. Read it before exploring.
- `docs/design/requirements.md` — what the library must do.
- `docs/design/structure.md` — the layout and the conventions in full.
- `docs/design/alternatives/` — the four designs compared in phase 1.
- `docs/adr/` — the decisions.
- `docs/research/` — spec inventory, better-result doctrine, toolchain, DX survey; `docs/research/raw/` holds the verbatim Render spec and JSON Schema.

## Workflow for new changes

Anything with a feature or design decision behind it runs through the skill chain below, in
order. Do not skip to code.

1. **`/to-spec`** — synthesises the conversation into a spec and publishes it to the issue
   tracker (a GitHub issue here) labelled `ready-for-agent`. It does not interview; it works
   from what has already been discussed, so do that discussion first. It stops once on the way
   to put its test seams to you.
2. **`/to-tickets`** — breaks the spec into **tickets**: tracer-bullet vertical slices, each
   declaring the tickets that **block** it. A ticket with no blockers can start at once; the
   rest wait on theirs. It puts the breakdown to you before it publishes, and publishes
   blockers first, so every edge names an issue that already exists.
3. **Dispatch each ticket to a Herdr agent** in its own worktree, per the Herdr agent workflow
   below. The branch is `<type>/<issue>-<slug>`, e.g. `feat/12-env-values`. `<type>` is the
   Conventional Commits type the work will land under, so the branch, the commits and the PR
   title all agree.
4. **Commit** per the rules under Codebase conventions. The `commit-msg` hook validates every one.
5. **Open the PR** with `gh pr create` against `main`. The title is a Conventional Commits
   subject; the body closes the issue (`Closes #12`). The agent opens it; the user merges it.

Both skills are `disable-model-invocation: true` — **the user invokes them.** Ask for `/to-spec`
rather than trying to run it, and never hand-roll a spec or a ticket to work around that.

Straight-to-`main` is only for what has no issue behind it: docs corrections, formatting, CI
plumbing. Anything a spec was written for gets a branch and a PR.

## Delegation policy (read first)

The session model (Fable) is the orchestrator, not the worker. Fable is the most expensive tier; spend its tokens only on decomposition, judgment calls, synthesis, and talking to the user. Delegate everything else to subagents via the Agent tool, picking the cheapest model that can do the job well:

- `model: "opus"` — the default worker tier. Anything requiring real judgment: implementation, debugging, architecture-aware exploration, adversarial review.
- `model: "sonnet"` — cheap tier for mechanical or low-stakes work: running tests and reporting output, simple greps/lookups with a known target, rote refactors from an exact spec, formatting, screenshot capture, admin chores. If getting it slightly wrong is cheap to catch, use sonnet.

- **Exploration/research**: never read broadly yourself. Spawn `Explore` agents (model: opus) with tightly scoped questions; consume their synthesized reports, not raw files. Trivial "find the file that defines X" lookups can go to sonnet. Use Exa instead of WebFetch for any web search that might require judgment or synthesis.
- **Implementation**: for any multi-file change, spawn `general-purpose` agents (model: opus) with exact file paths, the relevant doctrine from this file, and a definition of done (tests to run). Independent changes get parallel agents in one message.
- **Verification/review**: adversarial review and blast-radius checks go to opus agents. Plain test runs and lint passes go to sonnet agents.
- Fable itself only edits directly when the change is small (one or two files, already-known locations).
- **Tripwire (added after Fable did a 5-file change inline, 2026-08-26): before the first Edit/Write, count the files the change will touch. Three or more, or any screenshot/browser-proof chore: stop and spawn agents instead. Inline Fable work is only sequential diagnosis (each command depends on the previous answer) and 1-2 file edits.**

Token rules:

- Batch independent agent launches in a single message so they run concurrently.
- Give agents file paths and constraints up front so they don't rediscover this file's contents; paste the relevant doctrine into the prompt.
- Never re-read files an agent already summarized; trust the report, spot-check only what you'll edit.
- Read only the line ranges you need from large files (`docs/core/PROGRESS.md` is 835 lines — read the lessons ledger at the end, not the whole file).
- Don't echo file contents or long diffs back to the user; report conclusions.

## Herdr agent workflow

Implementation slices in phase 4 run as Herdr agents, one per issue, each in its own git
worktree, coordinated with the `to-agents` skill scripts at
`~/.agents/skills/to-agents/scripts/`. The Agent tool stays for research, exploration, and
review subagents that need no worktree. Fable coordinates; it does not implement slices.

Before the first dispatch of a session, read `~/.agents/skills/to-agents/SKILL.md` and its
`TRAPS.md`, and load the `herdr` skill. Where they disagree on CLI syntax, the `herdr` skill
wins. `test "${HERDR_ENV:-}" = 1` must pass; if it does not, stop and say so.

Preconditions for a dispatch: the issue is labelled `ready-for-agent`; `main` is pushed to
`origin` (dispatch refuses a local-only trunk); the working tree of the main checkout is clean.

- Dispatch: `dispatch.sh <repo> <issue> <branch> <prompt-file> --name <name> --setup "pnpm install"`.
  Branch is `<type>/<issue>-<slug>` (`feat/12-env-values`). Agent name starts with the slugged
  issue, lowercase letters, digits and hyphens, 32 characters at most (`i12-env-values`).
  Pass the setup every time; there is no Makefile. Workers run on Opus per the delegation
  policy, and the dispatch script has no model flag, so the setup command pins it through a
  per-worktree settings file that `.gitignore` already excludes:
  `--setup 'pnpm install --frozen-lockfile && mkdir -p .claude && printf "{\"model\":\"opus\"}\n" > .claude/settings.local.json'`.
  Confirm the pane's status line reads `Model: Opus` on the first read.
- After `herdr agent prompt`, `agent get` can still report `idle` for a few seconds. Re-read the
  status and the pane before concluding the prompt was lost; a second send duplicates the work.
- Write every prompt to a file under the scratchpad and pass the path. The brief carries: the
  issue and its parent; `CONTEXT.md` and the ADRs that touch the slice; the phase plan with an
  explicit stop after each phase; what is out of scope; `pnpm check` as the test command and the
  commit convention below; the traps of that slice and which other slices are in flight; and
  "open a PR against `main`, do not merge, never push to `main`". Ask the agent for its
  objections to the issue.
- Arm `watch.sh <agent> <worktree-path>` as a background task in the same turn as every prompt,
  dispatch included. A watcher fires once. Never sleep to poll an agent.
- Read the agent's report at `/tmp/to-agents-<agent>.report.md`, then verify against ground
  truth before believing it: `git status --porcelain` in the worktree, `pnpm check` run by you,
  the diff against `origin/main`, the acceptance criteria in the issue, and untracked files for
  secrets. Summarize each returned agent to the user in five lines: verdict, what changed, what
  you verified yourself versus what is only claimed, what is red, what needs the user.
- Before a PR reaches the user, run a read-only adversarial review by an Opus agent on any slice
  whose pattern later slices copy (a new factory kind, a new reference form, the emitter, the
  validation step, the CLI contract). In this project every such review found a defect the
  agent's own verification missed, three of them blocking. Send the findings to the owning agent
  as one prompt with a decision per finding; do not fix them yourself.
- Integrate with `probe-merge.sh` before promising anything about conflicts. Rebase stacked
  slices bottom-up and delegate each resolve to the agent that owns the upper branch.
  A child stacked on a sibling's branch conflicts the moment that sibling squash-merges, because
  the child still carries the parent's original commits: after the parent lands, have the child
  rebase its own commits onto `main` (`git rebase --onto origin/main <parent-tip>`) and re-verify
  before its merge.
- Merge only on an instruction from the user that names the merge. A green CI is permission to
  ask, never to merge.
- Clean up with `cleanup.sh <repo> --match <substr>`; always pass `--match`; it matches the worktree
  directory (`feat-5-env-sentinels-groups`), not the agent name; read the `verdict=` line.
- `status.sh <repo>` answers "where is everything" at any point.
- After a merge that changed the lockfile, run `pnpm install --frozen-lockfile` in the main checkout
  before trusting `pnpm check` there: a stale `node_modules` fails typecheck with TS2307 on a
  dependency a worker added, while every PR was green on CI's fresh install.

## Codebase conventions

- One package. The CLI is a `bin` entry in it, never a second package.
- `src/index.ts` is the only public entry and holds re-exports only. Add an export there rather
  than importing across a boundary that does not exist.
- Imports flow strictly upward: `json`/`enums`/`equal` → `references` → `env` → `resources` →
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
- Declare a tagged error as a class extending a hoisted, typed base constant:
  `const XBase: TaggedErrorClass<"X"> = TaggedError("X");` then `class X extends XBase<Props>`.
  TypeScript 7's `isolatedDeclarations` rejects `extends TaggedError("X")<Props>` with TS9021.
- The ordered list of YAML keys a resource can emit lives beside its factory (`WEB_SERVICE_FIELDS`
  in the web factory file); `src/synth/key-order.ts` reads it and validation reads it, because
  validation may not import synth.
- Every resource config has a hand-written public interface and a module-private Zod schema in
  the factory's file, built with `.readonly()` and `.exactOptional()` so the inferred type equals
  the interface. Export a `true` constant typed by an identity guard between the two; never let
  a schema be reachable from an exported declaration's type, or `isolatedDeclarations` fails.
  `validate` parses configs with the schemas; value rules are refinements; cross-resource rules
  stay rule functions. No schema and no Zod type crosses the public entry. See ADR-0003.
- Schemas use `z.strictObject`, and every kind has one `UnknownField` runtime test, because the
  identity guard cannot see strictness: `z.object` infers the same type and silently drops the
  unknown-field check. Never use `.default()`, `.transform()`, or `z.coerce` in a config schema;
  the parsed value is discarded and the author's value is emitted verbatim.
- A refinement raises its issue through the shared helper with a `validationCode` param, so it
  maps to its own `ValidationCode`; a refinement without one lands as `InvalidConfig`.
- Capture exit codes, never summaries. The `tsc` wrapper in this environment printed "No errors
  found" on a run whose raw log held a TS6059 error. Judge a gate by `$?` and the tool's own output.
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
- No `typeof` narrowing for control flow — discriminate on the union's own literal fields. The
  `in` operator is fine on a union whose members are told apart by a required key. No
  module mocking; `src/fs/` is the test seam, so pass an in-memory reader/writer.
- Tests assert the discriminated Result: narrow with `Result.isOk` / `Result.isError`, assert
  variants with `SomeError.is(...)` and `_tag`. Never assert on a thrown exception. `describe`
  names the exported symbol; `it` states the rule in the present indicative, never "should".
- Every compile-time row of design B's mistake matrix has a `*.test-d.ts` case using
  `@ts-expect-error`. Adding a compile-time guarantee means adding its type test.
- `test/fixtures/canonical/render.yaml` is the golden file. A test may rewrite only
  `test/fixtures/*/render.yaml` and the CLI seeds' `test/fixtures/cli/*/expected.yaml`, only under
  `UPDATE_FIXTURES=1` through `pnpm fixtures:update`, and a human reviews every diff by hand.
  `test/schema/render.yaml.schema.json` is the conformance oracle; refresh it with
  `pnpm schema:refresh`, never by hand, and never read `docs/research/raw/` from code.
- Run `pnpm check` before claiming done: format, lint, typecheck, tests, type tests.
- Run `pnpm format` before committing. The `pre-commit` hook in `.githooks/` formats the staged
  files with oxfmt, re-stages them, and runs oxlint on the staged source; a lint finding aborts
  the commit. Stage whole files, because the hook formats and re-stages whole files. Both hooks
  activate with `git config core.hooksPath .githooks`, which needs `pnpm install` first.
- `tools/oxlint/anti-slop/` is vendored output. Never edit it, never lint it, never weaken a rule
  to make lint pass — fix the code. Re-vendor with the `install-anti-slop` skill.
- Commits follow Conventional Commits, enforced by `.githooks/commit-msg`. Install it once per
  clone with `git config core.hooksPath .githooks`; git does not version hooks itself. Subject
  `<type>(<optional scope>)!: <description>`; types `build` `chore` `ci` `docs` `feat` `fix`
  `perf` `refactor` `revert` `style` `test`; description lowercase imperative, no trailing
  period; subject at most 72 characters, blank line before the body; the body explains why,
  not what. Every commit ends with a `Co-Authored-By` trailer naming the model that authored it
  (`Claude Fable 5.1` for the coordinator, `Claude Opus 5` for a dispatched worker), as each
  session's own attribution instruction states.
- Few comments. Only `SAFETY:` justifications and one-line spec citations (`// spec §16 B`). Never
  narrate what the code does — the types and the names carry that. Never cite an issue or PR number
  in code, a comment, or a test title; the tracker link belongs in the commit body and the PR.

## Agent skills

### Issue tracker

Issues live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root plus `docs/adr/`. See `docs/agents/domain.md`.
