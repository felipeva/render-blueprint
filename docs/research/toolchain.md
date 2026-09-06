# Toolchain research — Render blueprint → TypeScript library

Research date: **2026-09-05**. Machine: node **v22.22.2**, pnpm **10.33.4**, bun **1.3.4**.

Every version number below came from an `npm view` call or a binary I actually ran in a
throwaway scratchpad directory. Nothing was installed into this project. Claims that are
reasoning rather than observation are tagged **INFERRED**. Claims I could not settle are
tagged **UNCONFIRMED**.

Raw command output is in the [Appendix](#appendix-raw-command-outputs).

---

## Part 1 — anti-slop coding standard

Source: `git clone --depth 1 https://github.com/dmmulroy/anti-slop .reference/anti-slop`
→ version **0.1.2**, commit **`e8c4880`** ("chore: prepare v0.1.2").

### Philosophy (verbatim from the README)

> "Opinionated Oxlint rules that reject low-evidence and low-signal TypeScript and JavaScript patterns."

> "Anti-slop is first and foremost the ruleset I use with my work, projects, and team. It reflects my preferences and taste rather than attempting to be a universal coding standard."

> "**This project is meant to be vendored**, not treated as a fixed npm dependency. There is no official npm package. Copy the rules into your repository, read them, and change them to match your team's standards."

> "The rules use Oxlint's ESTree and lexical-scope APIs rather than a TypeScript type checker."

And from `skills/install-anti-slop/SKILL.md`:

> "Do not suppress rules, weaken rule severity, add unsafe casts, or mechanically launder types to make lint pass."

> "Prefer inference, `as const`, `satisfies`, named owner contracts, and boundary parsing when resolving findings."

The single thesis running through every rule's diagnostic message: **parse at the I/O
boundary, then carry a named domain type.** `as`, `unknown`, `object`,
`Record<string, unknown>`, `typeof`, and `Reflect.*` are all treated as ways to *claim*
evidence you never established.

That thesis is a good fit for this project. A Render blueprint generator is mostly
"take a typed spec, emit YAML" — the boundary is narrow and explicit, which is exactly
the shape these rules reward.

### The 15 generic rules (plugin name `anti-slop`)

Rule ids are `<plugin meta name>/<rules key>`. Snippets are lifted from each rule's own
`*.test.ts`.

| # | Rule id | Forbids → wants | Before → after |
|---|---------|-----------------|----------------|
| 1 | `anti-slop/no-chained-type-assertions` | Nested `as` chains that fabricate evidence → the original precise type, or one boundary parse. Chains of only `as const` stay valid. | `const value = input as unknown as User;` → `const value = input as User;` |
| 2 | `anti-slop/no-conditional-empty-object-spread` | `...(cond ? {x} : {})` to omit a field → separate statements. **No autofix by design** (omission ≠ assigning `undefined`). | `const result = { ...(value !== undefined ? { value } : {}) };` → `const result = condition ? { value } : {};` |
| 3 | `anti-slop/no-known-value-widening` | A syntactically known value flowing into an explicit `unknown`/`object`/open-dictionary target → inference, `satisfies`, or a named contract. | `const commands: Record<string, Command> = { start: startCommand };` → `const commands = { start: startCommand } satisfies Record<string, Command>;` |
| 4 | `anti-slop/no-module-mocking` | Vitest/Jest `mock`, `doMock`, `unstable_mockModule` (incl. aliased imports) → real dependency seams / DI. | `vi.mock('./user-store');` → `const store = new InMemoryUserStore();` |
| 5 | `anti-slop/no-object-parameters` | `object` on function inputs, incl. unions and same-file transparent generic aliases → an owner-provided named type. | `function f(value: object) {}` → `interface Owner { readonly id: string } function f(value: Owner) {}` |
| 6 | `anti-slop/no-reflect-apply` | Global `Reflect.apply` (static and `Reflect['apply']`) → a typed call or named dispatch interface. | `const value = Reflect.apply(operation, owner, args);` → `const value = operation.apply(owner, args);` |
| 7 | `anti-slop/no-reflect-get` | Global `Reflect.get` → typed property access, or parse dynamic input into a domain type first. | `const value = Reflect.get(owner, key);` → `const value = owner.property;` |
| 8 | `anti-slop/no-runtime-typeof` | Ad-hoc `typeof` narrowing → boundary decoding. Probes against literal `"undefined"` always allowed; option `allowInTypeGuards` (default `false`) permits `typeof` inside predicate functions. | `if (typeof input === "string") use(input);` → `const isServer = typeof document === "undefined";` |
| 9 | `anti-slop/no-shape-in-symbol-names` | Case-insensitive substring `shape` in any owned identifier → domain-role names. Statically-read borrowed members (Zod's `schema.shape`) exempt. | `type PayloadShape = { id: string };` → `const field = schema.shape.id;` (borrowed, allowed) |
| 10 | `anti-slop/no-unknown-parameters` | `unknown` (and unions containing it) on function inputs → a parsed named type. Two exemptions: a parameter literally named `cause`, and the subject of a type predicate. | `function parse(value: unknown): void {}` → `function isString(value: unknown): value is string { return true; }` |
| 11 | `anti-slop/no-unknown-returns` | Explicit return contracts resolving to `unknown` / `Promise<unknown>` / `PromiseLike<unknown>` → a parsed named type. | `function load(): unknown { return input; }` → `function load(): Promise<User> { return promise; }` |
| 12 | `anti-slop/no-unknown-type-aliases` | Type aliases whose resolved type is `unknown` → keep `unknown` visible at the boundary, not behind a name. | `type Alias = unknown;` → `type Box<T> = { readonly value: T }; type Payload = Box<unknown>;` |
| 13 | `anti-slop/no-unsafe-dictionary-type` | Dictionary **value** types based on `unknown`, `any`, `object`, `{}`, `NonNullable<unknown>`, empty interfaces → a concrete value contract. Generic constraints like `T extends Record<string, unknown>` allowed. | `type A = Record<string, unknown>;` → `type Commands = Record<string, Command>;` |
| 14 | `anti-slop/no-widen-then-assert` | An immutable local that widens known evidence to `unknown`/`any`/`object` and later asserts it back → keep the precise type end to end. | `const source = { id: 'second' }; const widened: unknown = source; const parsed = widened as { readonly id: string };` → `declare const input: unknown; const parsed = input as { readonly id: string };` |
| 15 | `anti-slop/require-safety-comment-for-type-assertion` | Any non-const assertion without a nearby non-empty `SAFETY:` justification. Option `markers` (default `["SAFETY"]`); marker needs a colon and real prose. Trailing comments rejected. | `const id = value as UserId;` → `// SAFETY: The parser established the UserId invariant.`<br>`const id = value as UserId;` |

### The Effect rule (plugin name `anti-slop-effect`, opt-in)

| # | Rule id | Forbids → wants | Before → after |
|---|---------|-----------------|----------------|
| 16 | `anti-slop-effect/no-service-constructor-imports` | Named `/^make[A-Z]/` imports from **relative** modules outside `*.test.*` / `*.spec.*` → import the owning Layer and yield the contextual service. | `import { makeIssueService } from "./issue-service.ts";` → `import { issueServiceLayer } from "./issue-service.ts";` |

**Not applicable here** unless we adopt Effect. The skill says to enable it only on a
direct package-manifest dependency or explicit request — never because `effect` appears
transitively in a lockfile.

### Plugin mechanics

**Yes, it runs on oxlint's JS plugin API.** Both entry points call `eslintCompatPlugin`
from `@oxlint/plugins`; every rule is a `defineRule({ meta, createOnce|create })`, and
tests use `RuleTester` from `oxlint/plugins-dev`.

The exact config shape, verbatim from README lines 49–51 and SKILL.md step 4:

```ts
jsPlugins: [
  { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
],
```

`jsPlugins` is a real, documented top-level key in oxlint's own JSON schema
(`node_modules/oxlint/configuration_schema.json`). Its value is an array of either a
bare path string or `{ name, specifier }`. The schema carries this warning verbatim:

> "Note: JS plugins are in alpha and not subject to semver."

**oxlint version.** anti-slop's `package.json` has **no `peerDependencies`**. It pins its
own dev environment at `oxlint 1.78.0` / `@oxlint/plugins 1.78.0` / `typescript 7.0.2`
(note: anti-slop itself already builds on TypeScript 7). That 1.78.0 is a dev pin, not a
floor. Both the README and SKILL.md instruct the agent *not* to trust remembered
versions but to match the repo's installed `oxlint`, or query npm if there is none, and to
pin `oxlint` and `@oxlint/plugins` to the **same exact version** so upgrades move together.

I verified anti-slop 0.1.2 works unmodified on **oxlint 1.81.0 / @oxlint/plugins 1.81.0**
(see e2e proof below).

**Config file format: both are accepted.** SKILL.md step 4 says verbatim: *"For
`oxlint.config.ts` or `.oxlintrc.json`, merge these fields with the existing
configuration"*. A third target is Vite+ (`lint.jsPlugins`, `lint.ignorePatterns`, plus
`fmt.ignorePatterns`). The README's only full worked example is `oxlint.config.ts`.

I tested **both** and both work — see the recommendation for which to pick and why.

**What `install.mjs` does.** 22 lines, one recursive `cpSync`. It writes no config,
installs no dependencies, runs no lint.
- Source: `<skill-dir>/assets/anti-slop`
- Destination: `resolve(process.cwd(), argv[0] ?? "tools/oxlint/anti-slop")`
- Refuses to overwrite an existing destination without `--force`
- Copies 23 files: `index.ts`, `effect/` (2), `rules/` (15), `shared/` (5)

Everything else in SKILL.md — dependency install, config merge, ignore patterns, running
lint and typecheck, reporting the diff — is prose for the agent to execute by hand.

**The rules are NOT type-aware.** This is the most important architectural fact. From the
README's "Analysis boundaries":

> "The rules use Oxlint's ESTree and lexical-scope APIs rather than a TypeScript type checker. They resolve same-file aliases—including block-scoped aliases, forward references, and transparent generic aliases—but do not infer imported type definitions or cross-file call signatures."

No tsconfig, no `parserServices`, no `project` option. `shared/type-alias-resolution.ts`
(250 lines) and `shared/dictionary-types.ts` (515 lines) hand-roll same-file resolution
over the AST + scope manager. Consequence: `type ImportedValue = unknown;` in another file
is invisible, so `function parse(): ImportedValue` passes. **anti-slop does not replace
`tsc --noEmit`** — SKILL.md step 5 tells you to run both.

**Stated caveats.** Not an npm package by design (`"private": true`). Taste, not a
standard. No cross-file inference. The Effect rule covers relative imports only — package
aliases are an acknowledged gap. No autofix on rule 2. Don't blanket-ignore dot-directories.

### Vendored copy vs the clone

**Identical. Zero drift.**

```
diff -ru .reference/anti-slop/skills/install-anti-slop \
         .agents/skills/install-anti-slop
# → no output, exit 0
```

Independent `shasum` over both trees matches for all 25 files. There is no version string
anywhere inside the skill directory (SKILL.md frontmatter is `name:` + `description:`
only), so byte-identity is the strongest available equivalence check — and it holds. The
vendored copy is exactly the v0.1.2 / `e8c4880` skill.

The skill has **not yet been run** against this project: no `tools/oxlint/anti-slop/`, no
`oxlint.config.*` or `.oxlintrc*`, and no root `package.json` at all.

### End-to-end proof (run in scratchpad, not this project)

Installed oxlint 1.81.0 + @oxlint/plugins 1.81.0 + typescript 7.0.2, ran
`node .reference/anti-slop/skills/install-anti-slop/scripts/install.mjs`, wrote a
`.oxlintrc.json` with the `jsPlugins` entry, and linted this file:

```ts
export type AnyValue = unknown;
export function widen(x: unknown): unknown { return x; }
export const bad = "a" as unknown as number;
export type Dict = Record<string, string>;
```

Result — five distinct rules fired on Node 22.22.2 with a `.ts` specifier:

```
src/bad.ts:1:13: error anti-slop(no-unknown-type-aliases): Type alias `AnyValue` hides `unknown`. ...
src/bad.ts:2:26: error anti-slop(no-unknown-parameters): Parameter `x` leaves input unparsed. ...
src/bad.ts:2:36: error anti-slop(no-unknown-returns): This function exposes `unknown` to its caller. ...
src/bad.ts:3:20: error anti-slop(no-chained-type-assertions): This assertion chain discards type evidence. ...
src/bad.ts:3:20: error anti-slop(require-safety-comment-for-type-assertion): This type assertion has no `SAFETY:` justification. ...
```

`Record<string, string>` correctly did **not** fire — a concrete value type is fine. The
identical rule set fired via `oxlint.config.ts` as well.

Two practical notes from that run:
- Loading a `.ts` plugin without `"type": "module"` in `package.json` emits a
  `MODULE_TYPELESS_PACKAGE_JSON` performance warning. We want `"type": "module"` anyway.
- Without ignore patterns, oxlint lints `node_modules` and anti-slop reports thousands of
  findings in `lib.dom.d.ts` and other vendored `.d.ts`. Ignore patterns are mandatory,
  not cosmetic.

---

## Part 2 — Toolchain facts

### TypeScript 7 is GA. `typescript@7.x` on npm *is* the Go compiler.

```
$ npm view typescript dist-tags --json
{ "dev": "3.9.4", "beta": "6.0.0-beta", "rc": "7.0.1-rc",
  "latest": "7.0.2", "next": "7.1.0-dev.20260905.1" }
```

`latest` is **7.0.2**. TypeScript 7.0 went GA on **2026-07-08**
([announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/);
beta 2026-04-21, RC 2026-06-18).

I unpacked the published package to confirm what the `tsc` binary actually is:

- `typescript@7.0.2` declares exactly one bin: **`{ "tsc": "bin/tsc" }`**. There is no
  `tsserver` and no `tsgo`.
- `bin/tsc` is `import "../lib/tsc.js"`, and `lib/tsc.js` is **26 lines** that
  `process.execve()` (or `execFileSync`) a native executable resolved by `getExePath()`.
- That executable is `@typescript/typescript-darwin-arm64/lib/tsc` — a **22.6 MB Go
  binary**. The package pulls 20 such platform packages as `optionalDependencies`.
- The `lib.*.d.ts` files ship inside the platform package, not the wrapper.

So: **`tsc` in TS7 is a thin Node shim in front of the Go native compiler.** `tsc --version`
prints `Version 7.0.2`.

**The JS compiler API is gone.** `typescript@7.0.2`'s main export is:

```json
"exports": { ".": "./lib/version.cjs", "./unstable/sync": "./dist/api/sync/api.js", ... }
```

and `lib/version.cjs` is three lines exporting only `version` and `versionMajorMinor`.
Anything doing `import ts from "typescript"` and touching `ts.sys`, `ts.createProgram`,
etc. **breaks**. A new API exists under `typescript/unstable/*` — the path segment says
`unstable` for a reason. Microsoft says 7.1 will ship a real (and different) API.

Microsoft's migration answer is `@typescript/typescript6` (**6.0.2**), which ships a
`tsc6` bin *and* re-exports the TS 6.0 JS API for tools that still need it. Note: the
GA post's example uses `"@typescript/native": "npm:typescript@^7.0.2"` — the left-hand
side there is an arbitrary **alias name**, not a real package. I verified
`@typescript/native` returns **404** on npm.

**`@typescript/native-preview` is superseded, not the current channel.**

```
$ npm view @typescript/native-preview version dist-tags
version = '7.0.0-dev.20260707.2'
dist-tags = { beta: '7.0.0-dev.20260421.2', latest: '7.0.0-dev.20260707.2' }
```

Last publish `20260707` — the day before GA. Its bin is still `tsgo`. It is **not
flagged deprecated on npm** (UNCONFIRMED whether a formal deprecation is planned), but
nightlies moved to `typescript@next` and the `typescript-go` repo header now reads that
it "was the staging repo… which is now completed". **Do not use it.** The name `tsgo` is
effectively retired.

**TypeScript 6.0** (`beta` tag, 6.0.0-beta; stable `@typescript/typescript6@6.0.2`,
released 2026-03-23) is the **last release on the JS "Strada" codebase** — the bridge
between 5.9 and 7.0, API-compatible with 5.9. Everything 7.0 removes is first deprecated
in 6.0 (silenceable with `"ignoreDeprecations": "6.0"`). No 6.1 is planned.

**TS7 gaps and behavior changes that matter to us:**

- **No stable programmatic API** (the big one). Blocks typescript-eslint, TypeDoc,
  ts-morph, ts-patch, ts-loader, Vue/Volar, Svelte, Astro. Expected in 7.1.
- **Removed → hard errors:** `target: es5`, `downlevelIteration`,
  `moduleResolution: node|node10|classic`, `module: amd|umd|systemjs|none`, `baseUrl`,
  `outFile`, the namespace `module` keyword. I confirmed from `tsc --help --all` that
  `--target` now offers only `es6/es2015`…`esnext` and `--moduleResolution` only
  `node16 | nodenext | bundler`.
- **Changed defaults:** `strict: true` (confirmed: `tsc --help --all` shows
  `--strict … default: true`), `target` = `es2025`, `module: esnext`,
  `noUncheckedSideEffectImports: true`, `rootDir: "./"`, and **`types: []`**. The last two
  are the ones Microsoft calls most surprising.
- **`--build` / `-b` is supported** (I ran `tsc --build --help` successfully), with new
  `--builders`, `--checkers`, `--singleThreaded` flags for parallelism.
- **Declaration emit and `isolatedDeclarations` are supported** — verified by emitting.
- Template literal types now split by Unicode **code point**, not UTF-16 code unit.

**Verified: a strict ESM library config compiles and emits cleanly under TS7.** I ran
`tsc --noEmit` (exit 0) and a full emit with `target es2023`, `module/moduleResolution
nodenext`, `strict`, `verbatimModuleSyntax`, `isolatedModules`, **`isolatedDeclarations`**,
`erasableSyntaxOnly`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`, `declaration`, `declarationMap`, `sourceMap`. Output
`index.d.ts`, `index.d.ts.map`, `index.js`, `index.js.map` — all correct.

### oxlint / oxfmt

```
oxlint            1.81.0   engines: ^20.19.0 || >=22.12.0
@oxlint/plugins   1.81.0
oxfmt             0.66.0   engines: ^20.19.0 || >=22.12.0
oxlint-tsgolint   7.0.2001
```

**`jsPlugins` is confirmed supported** — a documented top-level key in
`configuration_schema.json`, described as *"JS plugins, allows usage of ESLint plugins
with Oxlint"*, with the caveat *"JS plugins are in alpha and not subject to semver."*
TypeScript plugin files need Node `>=22.18.0` or `^20.19.0` (native type stripping).

**Config file formats — two experimental surfaces, don't confuse them:**

`oxlint --help` says verbatim:

> `-c, --config=<./.oxlintrc.json>` Oxlint configuration file
> * `.json` and `.jsonc` config files are supported in all runtimes
> * **JavaScript/TypeScript config files are experimental** and require running via Node.js

So `.oxlintrc.json` / `.oxlintrc.jsonc` are the stable formats; `oxlint.config.ts` is
experimental *as a config file*, separately from `jsPlugins` being alpha *as a feature*.
`oxlint --init` scaffolds `.oxlintrc.json`. **I ran both formats successfully** with
anti-slop registered.

**Type-aware linting is real and I verified it.** `oxlint@1.81.0` declares
`peerDependencies: { "oxlint-tsgolint": ">=7.0.2001", "vite-plus": "*" }`.
`oxlint-tsgolint@7.0.2001` is *"High-performance type-aware TypeScript linter powered by
typescript-go, for use with oxlint"* — its version tracks the TypeScript release
(`7.0.2001` = patch 0 for TypeScript 7.0.2). Type-aware linting
[went stable 2026-07-22](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable),
covering 59 of typescript-eslint's 61 type-aware rules.

Verified locally:

```
$ oxlint --type-aware src
src/typeaware.ts:3:3: error typescript(no-floating-promises): Promises must be awaited...

$ oxlint --type-aware --type-check src
src/typeerror.ts:1:14: error typescript(TS2322): Type 'string' is not assignable to type 'number'.
src/typeaware.ts:3:3: error typescript(no-floating-promises): ...
```

`--type-check` folds the actual TypeScript compiler diagnostics into oxlint's output —
byte-identical finding to what `tsc --noEmit` reported on the same file. It can replace a
separate typecheck step, though I'd keep `tsc --noEmit` as the source of truth (see risks).

**oxfmt config file is `.oxfmtrc.json`** — confirmed by running `oxfmt --init`, which
prints ``Created `.oxfmtrc.json`.`` and writes:

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "ignorePatterns": []
}
```

Also accepted: `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts` (JSON and TS configs
cannot coexist in one directory). `-c <path>` additionally accepts `.js/.mjs/.cjs/.cts`.
`--migrate prettier|biome` converts existing configs. oxfmt **does not read oxlint's
config** — separate files, separate schemas. It does read `.editorconfig` (nearest file only).

**oxfmt is NOT stable.** Version is `0.66.0`; the last status post is
[Oxfmt Beta (2026-02-24)](https://oxc.rs/blog/2026-02-24-oxfmt-beta), whose roadmap still
lists "Stability" as outstanding work. No 1.0 announcement exists. Recent changelogs are
dense with comment-placement fixes — consistent with pre-1.0. It is positioned for
production use (Prettier-compatible, ~30x faster than Prettier) but the semver says 0.x.

### better-result

```
$ npm view better-result version peerDependencies engines --json
"3.0.1"          # peerDependencies and engines are both ABSENT
```

`better-result@3.0.1` — *"Lightweight Result type with generator-based composition"*, MIT,
ESM-only (`"type": "module"`, single `import` condition → `./dist/index.mjs`,
`sideEffects: false`, types at `./dist/index.d.mts`). **No `engines`, no
`peerDependencies`, no runtime `dependencies`.**

The version mismatch worth flagging: its **devDependencies pin `typescript: "^5.4.0"`**,
alongside `oxfmt ^0.23.0`, `oxlint ^1.38.0`, `tsdown ^0.19.0-beta.5`, `vitest 3.2.4`.
So it is developed and tested against TypeScript 5, not 7. Because it declares no
peer range it will install silently against TS7 — nothing will warn you. Its published
`.d.mts` is plain declaration output, so it very likely type-checks fine under TS7
(**INFERRED** — I did not install and typecheck against it).

### Everything else

```
vitest        5.0.0    engines: ^22.12.0 || ^24.0.0 || >=26.0.0   (tags: V3 3.2.7, V4 4.1.11)
yaml          2.9.0    engines: >=14.6                            (next: 3.0.0-1)
tsdown        0.23.0   engines: ^22.18.0 || ^24.11.0 || >=26.0.0
tsup          8.5.1    engines: >=18
@types/node   26.4.1
zod           4.5.4
```

**tsdown 0.23.0 declares `peerDependencies: { "typescript": "^5.0.0 || ^6.0.0 || ^7.0.0" }`**
— explicit TS7 support. tsup 8.5.1 declares `"typescript": ">=4.5.0"`.

### Compatibility with TypeScript 7 — tested, not assumed

I installed the full stack with pnpm (`typescript@7.0.2 vitest@5.0.0 tsdown@0.23.0
yaml@2.9.0 @types/node@26.4.1 oxlint@1.81.0 @oxlint/plugins@1.81.0 oxfmt@0.66.0`) — clean
install, **zero peer warnings** — then ran each tool.

| Tool | Result with TS 7.0.2 |
|------|----------------------|
| **`tsc --noEmit`** | Exit 0 on a fully strict ESM config. |
| **`tsc` emit** | Emits `.js`, `.d.ts`, `.d.ts.map`, `.js.map` correctly. |
| **vitest 5.0.0 run** | Passed. TS is transformed by Vite/oxc at runtime — TS7 is irrelevant to *running* tests. |
| **`vitest run --typecheck`** | **Passed**, `Type Errors  no errors`. It shells out to the `tsc` CLI (`typecheck.checker` is `'tsc' \| 'vue-tsc' \| string`), and TS7's `tsc` keeps the same CLI/output shape. Prints its own warning: *"Testing types with tsc and vue-tsc is an experimental feature. Breaking changes might not follow SemVer, please pin Vitest's version when using it."* |
| **oxlint 1.81.0** | Needs no TypeScript at all (Rust core). Type-aware mode uses `oxlint-tsgolint`, which is built on typescript-go and **requires TypeScript 7+**. |
| **oxfmt 0.66.0** | Needs no TypeScript. |
| **tsdown 0.23.0** | **Works, but the generator choice is load-bearing** — see below. |
| **tsup 8.5.1** | **Broken for `--dts`.** Its bundled `rollup-plugin-dts@6.1.1` crashes on TS7 with `TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')` because `ts.sys` is `undefined` — the API TS7 removed. Bundling itself succeeds; declaration emit fails. Tracked in tsup#1405 / #1408 with an unreleased PR #1409. (Sourced from upstream issues, not reproduced locally.) |

**The tsdown detail that matters.** tsdown delegates `.d.ts` to `rolldown-plugin-dts`,
which has three generators and picks one automatically: `oxc` if `isolatedDeclarations` is
on; else `tsgo` if TypeScript 7 is installed; else `tsc`. I demonstrated both branches:

```
# isolatedDeclarations: true  →  oxc generator, silent
ℹ dist/index.d.mts  0.34 kB

# isolatedDeclarations: false →  falls back to the TS7 API
 WARN  TypeScript 7.0 does not yet have a stable API and is experimental.
       Some options will be unavailable.
ℹ Emit types with typescript@7.0.2
```

So installing `typescript@7` **silently opts you into the experimental generator** unless
you turn on `isolatedDeclarations`. With it on, dts generation never touches the unstable
TS7 API at all. That is a strong argument for `isolatedDeclarations: true`.

Also noted: tsdown 0.23 **deprecates `external`** in favour of `deps.neverBundle`
(`WARN  \`external\` is deprecated. Use \`deps.neverBundle\` instead.`), and by default it
*bundles* dependencies — my first build inlined all 234 kB of `yaml` into the output. A
library must mark runtime deps external.

### `bun test` as an alternative

**Viable as a runner, but it does not type-check, and there is no TS7 story because there
is nothing to have one about.**

- I confirmed `bun test --help` has **no `--typecheck` flag** (grep count: 0) on bun 1.3.4.
- Bun's docs: *"Bun transpiles TypeScript but does not type-check it… Use `bunx tsc --noEmit`."*
  Type checking is a wholly separate job, which you can point at `typescript@7`.
- Bun has **no declaration emitter**, so a published library still needs
  `tsc --emitDeclarationOnly` or oxc isolated declarations regardless.
- No type-level testing (`expectTypeOf`, `*.test-d.ts`) equivalent.
- Gaps vs vitest per Bun's own tracking issue (`oven-sh/bun#40990`): the `vitest` shim is
  missing ~70 members — `test.extend` fixtures, `vi.hoisted`, `vi.importActual`,
  `vi.mocked`, `vi.stubEnv`, `expect.poll`/`soft`, `toMatchFileSnapshot`, `onTestFailed`.
  A missing export is a **load-time SyntaxError that kills the whole file**, not a per-test
  failure. No `@vitest/ui`, no browser mode. (Exact list is a moving target — UNCONFIRMED.)
- What it does have: Jest-compatible API, snapshots, `mock()`/`spyOn()`, coverage
  (text + lcov), `--watch`, sharding, `--reporter=junit`.

For a small pure-logic library the speed difference is negligible and vitest's
`expectTypeOf` is genuinely useful for testing the generated blueprint types.

### `yaml` vs `js-yaml`

**Use `yaml@2.9.0` (eemeli).** For *generating* YAML it is the only one of the two with a
real document/AST model, which is exactly what a blueprint generator needs:

- **Comments and blank lines** — every node has `comment`, `commentBefore`, `spaceBefore`.
  The docs call this "a primary differentiator between this and other YAML libraries".
  Useful for emitting a `# Generated by …` header or annotating services.
- **Block scalars** — `defaultStringType` / `blockQuote: boolean | 'folded' | 'literal'`
  for multi-line `buildCommand` / `startCommand` values.
- **Key ordering** — you build `doc.contents` / `Pair`s in the order you want.
- **Anchors/aliases** — `doc.createAlias()`, `anchorPrefix`, `aliasDuplicateObjects`.
- Plus `lineWidth`, `indent`, `indentSeq`, `collectionStyle`, `simpleKeys`, `nullStr`.

`js-yaml`'s `dump()` has no comment support, no per-node scalar style, and no anchor naming.

**Do not use `yaml@next` (3.0.0-1).** The author's own warning: *"handle with care and
expect everything/anything to still change… a non-exact range like `^3.0.0-1` will almost
certainly eventually break your build."* Breaking so far: ESM-only with the **default
export dropped** (`import YAML from 'yaml'` → `import * as YAML`), `doc.contents` renamed
to `doc.value`, `.get()` lost `keepScalar`, `node.toJSON()` dropped, minimum TypeScript
raised to 5.9. No date for final v3.

I verified `yaml@2.9.0` `stringify` output matches expectations exactly in a vitest test.

---

## Part 3 — Recommendation

### Recommended stack

| Concern | Choice | Exact version | Rationale |
|---|---|---|---|
| **Package manager** | **pnpm** | `10.33.4` (installed) | Already installed and is anti-slop's own choice (`packageManager: pnpm@10.33.0`). I verified it resolves TS7's 20 platform `optionalDependencies` correctly and installed the whole stack with **zero peer warnings** — npm actually failed on the same task. Strict node_modules catches undeclared deps, which matters for a published library. Bun-as-installer buys nothing here since we're not using `bun test`. |
| **TypeScript** | **`typescript`** (the Go compiler) | `7.0.2` | GA since 2026-07-08; `latest` on npm. `tsc` *is* the native binary. Verified: strict ESM config type-checks and emits declarations cleanly. |
| **Type-check command** | **`tsc --noEmit`** | — | In TS7 there is no `tsc` vs `tsgo` choice left to make — `tsgo` only exists in the frozen `@typescript/native-preview`. Just run `tsc --noEmit`. Optionally add `oxlint --type-aware` for typescript-eslint-class rules (verified working). |
| **Linter** | **oxlint** + **@oxlint/plugins**, pinned **exactly equal** | both `1.81.0` | Rust, no TypeScript dependency, and it is the host anti-slop targets. anti-slop's install skill requires both pinned to the same exact version. Verified anti-slop 0.1.2 runs unmodified on 1.81.0. |
| **Lint config file** | **`.oxlintrc.json`** | — | JSON/JSONC is the **stable** format in all runtimes. `oxlint.config.ts` is flagged experimental by `oxlint --help` and needs Node. I verified both work — take the stable one; the config is static data, we gain nothing from TS. |
| **Type-aware lint** *(optional)* | **oxlint-tsgolint** | `7.0.2001` | Optional add-on. Stable since 2026-07-22, 59/61 typescript-eslint type-aware rules. Verified `--type-aware` catches `no-floating-promises` and `--type-check` reproduces `tsc`'s `TS2322` exactly. Add it once there's real async code. |
| **Formatter** | **oxfmt** | `0.66.0` | Same toolchain as oxlint, ~30x faster than Prettier, Prettier-compatible output. Accept 0.x churn (see risks). |
| **Format config file** | **`.oxfmtrc.json`** | — | Confirmed by running `oxfmt --init`. It does **not** read `.oxlintrc.json`. |
| **Test runner** | **vitest** | `5.0.0` | Verified passing with TS7, including `--typecheck` (which shells out to `tsc`). `expectTypeOf` / `*.test-d.ts` is the real differentiator — for a library whose whole product is types-plus-YAML, type-level tests are worth a lot. `bun test` can't type-check at all. |
| **Build / publish** | **tsdown** with **`isolatedDeclarations: true`** | `0.23.0` | Declares `typescript: "^5 \|\| ^6 \|\| ^7"`. With `isolatedDeclarations` on, dts goes through the **oxc** generator and never touches TS7's unstable API — verified. Set `deps.neverBundle: ["yaml"]` (`external` is deprecated in 0.23). **tsup is disqualified**: its `--dts` is broken on TS7. |
| **Build fallback** | plain **`tsc`** | `7.0.2` | **INFERRED but verified working**: for a library this small, `tsc` alone emits correct ESM + `.d.ts` + maps with zero extra dependencies and zero experimental surface. Keep it in your pocket if tsdown misbehaves. |
| **YAML serializer** | **`yaml`** | `2.9.0` | Only option with a document/AST model: programmatic comments, block scalars, key ordering, anchors — all things a blueprint generator wants. Pin to 2.x; **avoid `yaml@next` 3.0.0-1**. |
| **Node — devEngines** | `^22.18.0 \|\| ^24.11.0 \|\| >=26.0.0` | — | Driven by **tsdown 0.23.0**, the strictest in the stack. Installed 22.22.2 satisfies it. Also clears the `>=22.18.0` floor for `.ts` `jsPlugins` type-stripping. |
| **Node — published `engines`** | `>=22.12.0` | — | What *consumers* need. The library itself only needs `yaml` (`>=14.6`); `22.12.0` is the current LTS floor and matches vitest's own minimum. **INFERRED** — no external constraint forces this exact number. |
| **`@types/node`** | `26.4.1` | — | `latest`, and carries a `ts6.0` dist-tag. **UNCONFIRMED**: no `ts7.0` tag exists yet, so TS7 gets `latest` by default. Harmless today. |
| **Schema library** | **none yet — do not adopt** | (`zod@4.5.4` if ever) | Recorded as available only. This library *generates* YAML from typed input; it has no untrusted parse boundary that needs a runtime schema. Adding one now would be speculative. Revisit only if we start *reading* existing `render.yaml`. |

**One-line summary:** pnpm 10.33.4 · TypeScript 7.0.2 (`tsc --noEmit`) · oxlint 1.81.0 +
@oxlint/plugins 1.81.0 + vendored anti-slop via `.oxlintrc.json` · oxfmt 0.66.0
(`.oxfmtrc.json`) · vitest 5.0.0 · tsdown 0.23.0 with `isolatedDeclarations` · yaml 2.9.0 ·
Node `>=22.18.0` to develop.

### Known risks

1. **TypeScript 7 has no stable programmatic API.** This is the sharpest edge. `typescript@7`
   exports only `version`; `ts.sys`, `ts.createProgram` etc. are gone until 7.1. It already
   breaks tsup's `--dts`, typescript-eslint, TypeDoc, ts-morph, ts-patch. *Our stack dodges
   it* — oxlint is Rust, vitest shells out to the CLI, tsdown+`isolatedDeclarations` uses
   oxc — but **any future dependency that imports `typescript` as a library will break**.
   Mitigation: `@typescript/typescript6@6.0.2` (ships `tsc6` + the 6.0 API) can be added
   alongside under an alias.

2. **`isolatedDeclarations: true` is load-bearing, not decorative.** Turn it off and tsdown
   silently falls back to TS7's experimental API generator — I reproduced the exact warning.
   It also constrains authoring style: every exported symbol needs an explicit type
   annotation. That's a real ergonomic cost, and it's a cost anti-slop happens to push you
   toward anyway. Accept it deliberately, and add a CI check that it stays on.

3. **oxfmt is pre-1.0 (0.66.0).** No 1.0 announcement; the Feb 2026 beta post still lists
   "Stability" as open work; recent changelogs are full of comment-placement fixes.
   Formatting output can shift between 0.x releases and churn the diff. Mitigation: pin the
   exact version, upgrade deliberately, and run `oxfmt --check` in CI so drift is loud.

4. **oxlint JS plugins are alpha and explicitly not semver-protected.** Straight from
   oxlint's own schema: *"JS plugins are in alpha and not subject to semver."* anti-slop's
   entire delivery mechanism sits on this. A minor oxlint bump could break the plugin API.
   Mitigation: pin `oxlint` and `@oxlint/plugins` to the same exact version (which the
   install skill already mandates) and upgrade both together, deliberately.

5. **better-result targets TypeScript 5.** Its devDependencies pin `typescript: ^5.4.0`,
   and it declares **no `peerDependencies` and no `engines`** — so npm/pnpm will install it
   against TS7 silently, with nothing to warn you. It will probably be fine (its published
   `.d.mts` is plain declaration output) but that is **INFERRED**, not tested. If we adopt
   it, typecheck a spike against TS7 before committing.

6. **anti-slop is not type-aware and does not replace `tsc`.** It reads the AST and
   same-file scope only; imported type definitions and cross-file signatures are invisible.
   Run `tsc --noEmit` *and* `oxlint`. Also: anti-slop is a vendored 0.1.2 snapshot of one
   person's taste, deliberately not an npm package — we own the copy and any upgrade is a
   manual re-vendor plus diff.

7. **`vitest --typecheck` is self-declared experimental**: *"Breaking changes might not
   follow SemVer, please pin Vitest's version when using it."* Pin vitest exactly if we
   rely on `*.test-d.ts`.

8. **TS7's changed defaults will bite on a config you didn't write carefully.** `strict`
   now defaults true, `types` defaults to `[]` (so `@types/node` is *not* picked up unless
   you ask), and `rootDir` defaults to `"./"`. Be explicit about all three. The skeleton
   below is.

9. **tsdown bundles dependencies by default.** My first build inlined 234 kB of `yaml` into
   the library output. For a published library that is wrong. `deps.neverBundle` is
   mandatory, and `external` is deprecated as of 0.23.

### Config skeletons

All three were run in a scratchpad. Items I could not fully verify are marked inline.

#### `tsconfig.json`

Verified: `tsc --noEmit` exits 0 and a full emit produces correct `.js` / `.d.ts` /
`.d.ts.map` / `.js.map` under TypeScript 7.0.2.

```jsonc
{
  "compilerOptions": {
    // --- Output target ---
    "target": "es2023",                       // TS7 default is es2025; pin explicitly
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",           // TS7 removed "node"/"node10"/"classic"
    "types": ["node"],                        // TS7 defaults this to [] — must be explicit

    // --- Strictness ---
    "strict": true,                           // default true in TS7; keep it written down
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "noUncheckedSideEffectImports": true,     // default true in TS7

    // --- ESM / emit discipline ---
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,             // REQUIRED: keeps tsdown on the oxc dts path
    "erasableSyntaxOnly": true,               // no enums / param properties / namespaces

    // --- Emit ---
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",                         // TS7 defaults rootDir to "./" — be explicit
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Two options I deliberately left **out**, both marked **UNSURE — decide later**:
- `"allowImportingTsExtensions"` + `"rewriteRelativeImportExtensions"` — these let you
  write `import "./x.ts"`. I verified they type-check fine under TS7, but I did **not**
  verify how tsdown's oxc dts generator handles the rewrite. Only adopt after testing.
- `"composite"` / `"incremental"` — irrelevant for a single-package library; revisit only
  if this becomes a monorepo.

#### `.oxlintrc.json`

Verified end-to-end: this exact shape loaded the vendored anti-slop plugin on oxlint
1.81.0 / Node 22.22.2 and reported the expected violations.

Prerequisite: `node .agents/skills/install-anti-slop/scripts/install.mjs`, which creates
`tools/oxlint/anti-slop/`.

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc"],
  "categories": { "correctness": "error" },

  // Must include the plugin's own directory, or anti-slop lints itself.
  // Do NOT blanket-ignore all dot-directories (SKILL.md is explicit about this).
  "ignorePatterns": [
    ".agents/**",
    ".claude/**",
    ".reference/**",
    "dist/**",
    "tools/oxlint/anti-slop/**"
  ],

  // NOTE: oxlint's own schema says "JS plugins are in alpha and not subject to semver".
  // The .ts specifier needs Node >= 22.18.0 (native type stripping).
  "jsPlugins": [
    { "name": "anti-slop", "specifier": "./tools/oxlint/anti-slop/index.ts" }
  ],

  "rules": {
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error"
  }
}
```

The `anti-slop-effect` plugin is **omitted on purpose** — we have no direct `effect`
dependency.

#### `.oxfmtrc.json`

The filename is confirmed by `oxfmt --init`. The default file it writes is only
`{ "$schema": ..., "ignorePatterns": [] }`; the options below are from oxc's documented
schema. Values shown are oxfmt's own defaults unless noted.

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,          // default
  "tabWidth": 2,              // default
  "useTabs": false,           // default
  "semi": true,               // default
  "singleQuote": false,       // default
  "trailingComma": "all",     // default
  "sortImports": true,        // NOT default (default off) — opt in for stable diffs
  "sortPackageJson": true,    // default is already on
  "ignorePatterns": [
    ".reference/**",
    "dist/**",
    "tools/oxlint/anti-slop/**"
  ]
}
```

**UNSURE:** I confirmed `sortImports` and `sortPackageJson` exist and their defaults from
the documented option list, but did not exercise them. `sortTailwindcss` exists too and is
irrelevant here. If any key is rejected, `oxfmt --init` plus the bundled
`configuration_schema.json` is the authority.

#### Suggested `package.json` scripts (INFERRED — not executed as a set)

```jsonc
{
  "type": "module",           // required; also silences MODULE_TYPELESS_PACKAGE_JSON
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "test": "vitest run",
    "test:types": "vitest run --typecheck",
    "build": "tsdown"
  }
}
```

---

## Appendix: raw command outputs

### TypeScript

```
$ npm view typescript dist-tags --json
{
  "dev": "3.9.4",
  "tag-for-publishing-older-releases": "4.1.6",
  "insiders": "4.6.2-insiders.20220225",
  "beta": "6.0.0-beta",
  "rc": "7.0.1-rc",
  "latest": "7.0.2",
  "next": "7.1.0-dev.20260905.1"
}

$ npm view typescript versions --json | tail -30
  "7.1.0-dev.20260806.1",
  ... (daily nightlies) ...
  "7.1.0-dev.20260903.1",
  "7.1.0-dev.20260904.1",
  "7.1.0-dev.20260905.1"
]

$ npm view @typescript/native-preview version dist-tags
version = '7.0.0-dev.20260707.2'
dist-tags = { beta: '7.0.0-dev.20260421.2', latest: '7.0.0-dev.20260707.2' }

$ npm view @typescript/typescript6 version
6.0.2                       # bin: { "tsc6": "bin/tsc6" }

$ npm view @typescript/native
npm error 404 Not Found — '@typescript/native@*' is not in this registry.
```

`typescript@7.0.2` package metadata (abridged):

```json
{
  "bin":     { "tsc": "bin/tsc" },
  "engines": { "node": ">=16.20.0" },
  "type": "module",
  "exports": {
    ".": "./lib/version.cjs",
    "./unstable/sync":  "./dist/api/sync/api.js",
    "./unstable/async": "./dist/api/async/api.js",
    "./unstable/ast":   "./dist/ast/index.js"
  },
  "optionalDependencies": {
    "@typescript/typescript-darwin-arm64": "7.0.2",
    "@typescript/typescript-linux-x64":    "7.0.2",
    "... 18 more platform packages ...":   "7.0.2"
  }
}
```

`typescript@6.0.0-beta` for contrast — JS compiler, ships `tsserver`, **no native deps**:

```json
{ "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" },
  "engines": { "node": ">=14.17" },
  "dependencies": null, "optionalDependencies": null }
```

What is actually inside the installed `typescript@7.0.2`:

```
$ ls node_modules/typescript/lib
getExePath.d.ts  getExePath.js  tsc.js (609B)  version.cjs  version.d.cts
# NOTE: there is no lib/typescript.js — the JS compiler API is gone.

$ cat node_modules/typescript/bin/tsc
#!/usr/bin/env node
import "../lib/tsc.js";

$ cat node_modules/typescript/lib/tsc.js
#!/usr/bin/env node
import getExePath from "#getExePath";
import { execFileSync } from "node:child_process";
const exe = getExePath();
if (process.platform !== "win32" && typeof process.execve === "function") {
    try { process.execve(exe, [exe, ...process.argv.slice(2)]); } catch {}
}
try { execFileSync(exe, process.argv.slice(2), { stdio: "inherit" }); }
catch (e) { if (e.status) { process.exitCode = e.status; } else { throw e; } }

$ cat node_modules/typescript/lib/version.cjs
const { version } = require("../package.json");
exports.version = version;
exports.versionMajorMinor = "7.0";

$ ls -la node_modules/@typescript/typescript-darwin-arm64/lib/ | tail -1
755  tsc  22.6M                        # <- the Go native binary

$ ./node_modules/.bin/tsc --version
Version 7.0.2
```

Selected `tsc --help --all` entries (defaults changed in TS7 in **bold** prose above):

```
--strict                     type: boolean   default: true
--target, -t                 one of: es6/es2015 … esnext            default: es2025
--module, -m                 one of: commonjs, es6/es2015, es2020, es2022, esnext,
                                     node16, node18, node20, nodenext, preserve
--moduleResolution           one of: node16, nodenext, bundler
--isolatedDeclarations       type: boolean   default: false
--verbatimModuleSyntax       type: boolean   default: false
--exactOptionalPropertyTypes type: boolean   default: false
--noUncheckedIndexedAccess   type: boolean   default: false
--erasableSyntaxOnly         type: boolean   default: false
--declaration, -d            type: boolean   default: false, unless composite is set
--build, -b                  Build one or more projects and their dependencies
```

New TS7-only flags observed in `--help --all`: `--builders`, `--checkers`,
`--singleThreaded`, `--stableTypeOrdering`, `--stopBuildOnErrors`, `--pprofDir`,
`--deduplicatePackages`, `--watchInterval`, `--ignoreConfig`.

Strict ESM library build, TypeScript 7.0.2:

```
$ tsc --noEmit -p tsconfig.json
noEmit EXIT=0

$ tsc -p tsconfig.json
emit EXIT=0
$ ls dist
index.d.ts  index.d.ts.map  index.js  index.js.map

$ cat dist/index.d.ts
export interface ServiceSpec {
    readonly name: string;
    readonly plan?: "free" | "starter";
}
export declare const renderService: (spec: ServiceSpec) => string;
//# sourceMappingURL=index.d.ts.map
```

### oxlint / oxfmt / tsgolint

```
$ npm view oxlint version dist-tags
version = '1.81.0'
dist-tags = { latest: '1.81.0' }

$ npm view @oxlint/plugins version dist-tags
version = '1.81.0'
dist-tags = { latest: '1.81.0' }

$ npm view oxfmt version dist-tags
version = '0.66.0'
dist-tags = { latest: '0.66.0' }

$ npm view oxlint-tsgolint version dist-tags description --json
{ "version": "7.0.2001",
  "dist-tags": { "latest": "7.0.2001" },
  "description": "High-performance type-aware TypeScript linter powered by typescript-go, for use with oxlint." }
```

oxlint's declared peers — this is how type-aware linting is wired:

```json
"peerDependencies": { "oxlint-tsgolint": ">=7.0.2001", "vite-plus": "*" }
```

`oxlint --help` (config formats):

```
Usage: [-c=<./.oxlintrc.json>] [PATH]...
    -c, --config=<./.oxlintrc.json>  Oxlint configuration file
                     * `.json` and `.jsonc` config files are supported in all runtimes
                     * JavaScript/TypeScript config files are experimental and require
                       running via Node.js
                     * you can use comments in configuration files.
```

`oxlint` config schema — top-level keys and the `jsPlugins` entry:

```
title: Oxlintrc
  $schema, categories, env, extends, globals, ignorePatterns,
  jsPlugins, options, overrides, plugins, rules, settings

jsPlugins: "JS plugins, allows usage of ESLint plugins with Oxlint.
            Note: JS plugins are in alpha and not subject to semver.
            TypeScript plugin files are supported in the following environments:
            - Deno and Bun: natively.
            - Node.js >=22.18.0 and Node.js ^20.19.0: with built-in type-stripping."
  anyOf: [ null, array<ExternalPluginEntry>, uniqueItems ]
```

Generated defaults:

```
$ oxfmt --init
Created `.oxfmtrc.json`.
{ "ignorePatterns": [] }

$ oxlint --init
Configuration file created
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc"],
  "categories": { "correctness": "error" },
  "rules": {},
  "env": { "builtin": true }
}
```

`oxfmt --help` (mode + config options):

```
        --init               Initialize `.oxfmtrc.json` with default values
        --migrate=SOURCE     Migrate configuration to `.oxfmtrc.json` from specified source
                             Available sources: prettier, biome
    -c, --config=PATH        Path to the configuration file
                             (.json, .jsonc, .ts, .mts, .cts, .js, .mjs, .cjs)
        --check              Check if files are formatted, also show statistics
```

Type-aware linting, verified:

```
$ oxlint --type-aware src
src/typeaware.ts:3:3: error typescript(no-floating-promises): Promises must be awaited,
  add void operator to ignore.

$ oxlint --type-aware --type-check src
src/typeerror.ts:1:14: error typescript(TS2322): Type 'string' is not assignable to type 'number'.
src/typeaware.ts:3:3: error typescript(no-floating-promises): ...

$ tsc --noEmit -p tsconfig.json          # same file, for comparison
src/typeerror.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
```

### anti-slop end-to-end

```
$ node .reference/anti-slop/skills/install-anti-slop/scripts/install.mjs
Copied the anti-slop plugin to <cwd>/tools/oxlint/anti-slop
Configure Oxlint with: <cwd>/tools/oxlint/anti-slop/index.ts

$ node --version
v22.22.2

$ oxlint src        # .oxlintrc.json with jsPlugins: [{ name, specifier: "./tools/.../index.ts" }]
src/bad.ts:1:13: error anti-slop(no-unknown-type-aliases): Type alias `AnyValue` hides `unknown`.
  Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise
  use the parsed owner type.
src/bad.ts:2:26: error anti-slop(no-unknown-parameters): Parameter `x` leaves input unparsed.
  Accept a named domain type; run the expected schema or parser at the I/O boundary before
  calling this function.
src/bad.ts:2:36: error anti-slop(no-unknown-returns): This function exposes `unknown` to its
  caller. Parse the value at its boundary and return a named domain type.
src/bad.ts:3:20: error anti-slop(no-chained-type-assertions): This assertion chain discards
  type evidence. Keep the original precise type, or parse untrusted input at its boundary
  before narrowing it.
src/bad.ts:3:20: error anti-slop(require-safety-comment-for-type-assertion): This type
  assertion has no `SAFETY:` justification. State the checked invariant immediately before
  the assertion or its containing statement.

$ oxlint -c oxlint.config.ts src         # same findings via the experimental TS config
EXIT=1
```

Vendored-copy diff:

```
$ diff -ru .reference/anti-slop/skills/install-anti-slop \
           .agents/skills/install-anti-slop
# (no output, exit 0 — byte-identical, 25 files)
```

### Other packages

```
$ npm view better-result version peerDependencies engines --json
"3.0.1"                     # peerDependencies and engines are ABSENT

$ npm view better-result --json   (selected)
{ "name": "better-result", "version": "3.0.1", "license": "MIT",
  "description": "Lightweight Result type with generator-based composition",
  "homepage": "https://better-result.dev",
  "engines": null, "peerDependencies": null, "dependencies": null,
  "type": "module", "types": "./dist/index.d.mts", "sideEffects": false,
  "exports": { ".": { "types": "./dist/index.d.mts",
                      "import": "./dist/index.mjs",
                      "default": "./dist/index.mjs" } },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "3.2.4",
                       "oxlint": "^1.38.0", "oxfmt": "^0.23.0",
                       "tsdown": "^0.19.0-beta.5", "fast-check": "^4.9.0",
                       "@types/bun": "latest" } }

$ npm view vitest version dist-tags
version = '5.0.0'
dist-tags = { V3: '3.2.7', beta: '5.0.0-beta.7', rc: '5.0.0-rc.4',
              latest: '5.0.0', V4: '4.1.11' }

$ npm view yaml version dist-tags
version = '2.9.0'
dist-tags = { latest: '2.9.0', next: '3.0.0-1' }

$ npm view tsdown version dist-tags
version = '0.23.0'
dist-tags = { latest: '0.23.0', beta: '0.23.0-beta.3', rc: '0.23.0-rc.1' }

$ npm view tsup version dist-tags
version = '8.5.1'
dist-tags = { latest: '8.5.1' }

$ npm view @types/node version
26.4.1                      # dist-tags include ts5.9, ts6.0 — no ts7.0 tag exists

$ npm view zod version dist-tags
version = '4.5.4'
dist-tags = { latest: '4.5.4', beta: '4.1.13-beta.0',
              canary: '4.5.0-canary.20260828T171753' }
```

Engines and TypeScript peer ranges:

```
vitest@5.0.0           {"node":"^22.12.0||^24.0.0||>=26.0.0"}
tsdown@0.23.0          {"node":"^22.18.0||^24.11.0||>=26.0.0"}
yaml@2.9.0             {"node":">=14.6"}
oxlint@1.81.0          {"node":"^20.19.0||>=22.12.0"}
oxfmt@0.66.0           {"node":"^20.19.0||>=22.12.0"}
typescript@7.0.2       {"node":">=16.20.0"}
tsup@8.5.1             {"node":">=18"}

tsdown@0.23.0 peerDependencies: { "typescript": "^5.0.0 || ^6.0.0 || ^7.0.0", ... }
tsup@8.5.1    peerDependencies: { "typescript": ">=4.5.0", ... }
vitest@5.0.0  peerDependencies: { "vite": "^6.4.0 || ^7.0.0 || ^8.0.0",
                                  "@types/node": "^22.0.0 || >=24.0.0", ... }
```

### Full-stack install and run (pnpm 10.33.4)

```
$ pnpm add -D typescript@7.0.2 vitest@5.0.0 tsdown@0.23.0 yaml@2.9.0 \
              @types/node@26.4.1 oxlint@1.81.0 @oxlint/plugins@1.81.0 oxfmt@0.66.0
Packages: +71
devDependencies:
+ @oxlint/plugins 1.81.0   + @types/node 26.4.1   + oxfmt 0.66.0   + oxlint 1.81.0
+ tsdown 0.23.0            + typescript 7.0.2     + vitest 5.0.0   + yaml 2.9.0
Done in 1.8s using pnpm v10.33.4
# (zero peer warnings; `npm install` of the same set failed with
#  "Cannot read properties of null (reading 'edgesOut')")

$ tsc --noEmit -p tsconfig.json
EXIT=0

$ vitest run
 RUN  v5.0.0
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  124ms

$ vitest run --typecheck
Testing types with tsc and vue-tsc is an experimental feature.
Breaking changes might not follow SemVer, please pin Vitest's version when using it.
 Test Files  2 passed (2)
      Tests  2 passed (2)
 Type Errors  no errors
```

tsdown, both dts generator branches:

```
# tsconfig has isolatedDeclarations: true  ->  oxc generator, no warning
$ tsdown
ℹ tsdown v0.23.0 powered by rolldown v1.2.7
ℹ dist/index.mjs        0.19 kB
ℹ dist/index.d.mts      0.34 kB
✔ Build complete in 63ms

# tsconfig has isolatedDeclarations: false ->  falls back to the TS7 API
$ tsdown
 WARN  TypeScript 7.0 does not yet have a stable API and is experimental.
       Some options will be unavailable.
ℹ Emit types with typescript@7.0.2
✔ Build complete in 116ms

# default (no externals) bundles dependencies into the library:
ℹ Hint: consider adding deps.onlyBundle option to avoid unintended bundling
Detected dependencies in bundle:
- yaml
ℹ dist/index.mjs        234.27 kB │ gzip: 53.23 kB     # <- all of `yaml` inlined

# with externals set:
 WARN  `external` is deprecated. Use `deps.neverBundle` instead.
ℹ dist/index.mjs        0.19 kB

$ cat dist/index.d.mts
//#region src/index.d.ts
export interface RenderService {
  readonly type: "web";
  readonly name: string;
  readonly plan?: "free" | "starter";
}
export interface Blueprint { readonly services: readonly RenderService[]; }
export declare const toYaml: (blueprint: Blueprint) => string;
//#endregion
```

bun and oxfmt:

```
$ bun --version
1.3.4

$ bun test --help | grep -i -c typecheck
0                           # no --typecheck flag exists

$ oxfmt --check src
Checking formatting...
src/index.test.ts (0ms)
src/index.ts (0ms)
Format issues found in above 2 files. Run without `--check` to fix.
Finished in 6ms on 2 files using 14 threads.
```
