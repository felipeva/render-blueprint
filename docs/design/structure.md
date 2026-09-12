# Structure — repository layout, boundaries, and conventions

Phase 2. Inputs: ADR-0001 (design B plus three borrowings), ADR-0002 (library primary, thin CLI),
`docs/design/alternatives/b-factories-typed-refs.md` §2 (the interface this document arranges into
files), `docs/design/requirements.md`, `docs/research/toolchain.md` Part 3,
`docs/research/better-result.md` §5. Nothing here reopens an ADR; anything not traceable to those
documents is marked **INFERRED**.

§2, §3 and §7 describe the repository as it stands and are corrected whenever it moves; the rest is
the reasoning that put it there. `AGENTS.md` states the conventions in force and `CONTRIBUTING.md`
maps a task to the files and the tests it touches.

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
map the `Result` to exit codes 0/1/2 — and gives it no logic of its own. A directory that small does
not earn a second package, a `workspace:*` link, a second tsconfig, and a publish ordering
constraint.
Consumers install one thing, so `npx render-blueprint check` works in CI from the dependency they already
have; splitting forces `render-blueprint` plus `render-blueprint-cli` on everyone. tsdown emits both entries from one
config, and the toolchain doc's `tsconfig.json` skeleton omits `composite`/`incremental` as
"irrelevant for a single-package library" — staying single keeps it usable unmodified. The cost,
the CLI shipping to library-only consumers, is `node:fs` + `node:path` + a dynamic `import()`.
Issue #22 was that revisit: the CLI now depends on `@drizzle-team/brocli` for its command
declarations, so library-only consumers install it too. It is a zero-dependency package that
`neverBundle` keeps out of the library entries, which is what kept the single package worth it.
`render-blueprint` is the npm name, decided separately.

## 2. Folder tree

```
.
├── .agents/skills/                  vendored agent skills — the source of truth
│   ├── install-anti-slop/           existing; scripts/install.mjs writes tools/oxlint/anti-slop/
│   └── adopt-better-result/         NEW — vendored from .reference (§2.1)
├── .claude/skills/                  symlinks into ../../.agents/skills
├── .github/workflows/               ci.yml runs install, `pnpm check`, `pnpm build`, then
│                                    `node dist/cli.js --help`; test.yml runs install, `pnpm test`
│                                    and `pnpm test:types` on their own
├── docs/                            unchanged: adr/ agents/ design/ research/ research/raw/
├── scripts/                         refresh-render-schema.mjs re-downloads the Render JSON Schema
│                                    into test/schema/ (§6.3); check-declarations.mjs fails the build
│                                    if dist/index.d.ts names a Zod type (ADR-0003)
├── src/                             the only compiled source root (tsconfig rootDir)
│   ├── index.ts                     THE public entry — re-exports only, no logic
│   ├── testing.ts                   the `render-blueprint/testing` subpath — memoryFilePort only,
│                                    so a consumer's runtime bundle never carries the in-memory port
│   ├── json.ts                      JsonValue / JsonObject — the escape-hatch types (design B §7)
│   ├── raise.ts                     the one way a schema refinement raises a custom issue carrying
│                                    a validationCode, so validation/translate-schema-issue.ts can
│                                    map it back to a ValidationCode; beside it whenFieldsParsed and
│                                    whenValueParsed, the guards that name which earlier parse
│                                    failures make a refinement skip, and readingFields, which
│                                    states once the fields a cross-field rule reads, for its guard
│                                    and for the issue it raises, so validation can tell which of
│                                    them a defaults scope supplied; list there only what the rule
│                                    reads, and put a field it needs parsed but does not read, such
│                                    as the runtime a union branch needs, in its second argument,
│                                    which only the guard sees
│   ├── bounded-integer.ts           z.int() plus the bound the spec sets, raising the one
│                                    OutOfRange code every bounded number shares (issue #12)
│   ├── equal.ts                     Equal / Expect — the identity-guard pair every schema-versus-
│                                    interface guard is typed by (ADR-0003)
│   ├── enums/                       `as const` tuples + derived unions, one family per file:
│   │                                auto-deploy-trigger, connection-pool, database-property,
│   │                                environment-protection, key-value-persistence-mode,
│   │                                maxmemory-policy, network-isolation, plan,
│   │                                postgres-major-version, preview-generation,
│   │                                referenceable-service-type, region, render-provided-key,
│   │                                render-subdomain-policy, route-type, runtime,
│   │                                service-property (spec §6.6)
│   ├── references/                  what a resource exposes; the core of design B
│   │   ├── reference-value.ts       DatabaseReferenceValue, ServiceReferenceValue (the XOR union)
│   │   ├── reference-origin.ts      ReferenceOrigin — 'blueprint' | 'external', a target's origin
│   │   ├── service-target.ts        ServiceTarget; serviceProperty and serviceEnvVar build a
│   │   │                            ServiceReferenceValue from it
│   │   ├── postgres-reference.ts  key-value-reference.ts  http-service-reference.ts   the four
│   │   ├── opaque-service-reference.ts   handles: host/port/hostport vs envVar/renderVar only
│   │   ├── registry-credential-reference.ts   RegistryCredentialReference — the fromRegistryCreds
│   │   │                            form a private image's creds take; external-only (spec §4.2)
│   │   └── external.ts              the `external` object — handles with no `kind`, so unlistable
│   ├── env/                         env values and the map→list problem
│   │   ├── env-value.ts             EnvValue, EnvGroupValue, EnvironmentMap, EnvGroupEnvironment
│   │   ├── literal.ts  secret.ts  generated.ts   the three "value lives elsewhere" sentinels
│   │   ├── resolve-env.ts           map | (self)=>map + envGroups → ordered entries, one per env
│                                    var form. The group/direct collision and the duplicate key are
│                                    validation/env-key-origins.ts (ADR-0001, from D), which
│                                    resolves an imported group by name the way Render does
│   │   └── self-environment.ts      SelfEnvironment<H> = (self: H) => EnvironmentMap; selfEnvironment
│                                    resolves it against the resource's own handle
│   ├── resources/                   one factory per kind; each returns an inert value
│   │   ├── service-fields.ts        the shared maps of common repo-sourced service fields, required and
│   │   │                            exact-optional forms; factories spread them (ADR-0003, issue #20)

│   │   ├── resource.ts  service-source.ts   the BlueprintResource union, the `kind` discriminator
│   │   │                            and the accessors its readers share; it parses nothing and
│   │   │                            names no schema. The repo+branch | dockerfilePath | image
│   │   │                            source union the four sourced kinds share, and the tuple of
│   │   │                            keys its branches own
│   │   ├── disk.ts  scaling.ts  build-filter.ts  ip-allow-list.ts  previews.ts
│   │   │   subdomain-policy.ts  is-cron-expression.ts  ip-source.ts
│   │   │                            the sub-configs shared across service kinds, each with its own
│   │   │                            ordered field tuple. disk.ts also carries DiskPreventsScaling
│   │   │                            for the three kinds that spread it and scaling.ts the two
│   │   │                            scaling codes; previews.ts holds the serverService previews
│   │   │                            object alone, because a static site, Postgres and Key Value
│   │   │                            each take a different one (issue #12); ip-allow-list.ts holds
│   │   │                            the array schema with the entry nested inside it, and the guard
│   │   │                            over the pair, spread by web services, static sites, Key Value
│   │   │                            and Postgres and required on Key Value alone (issue #40), and
│   │   │                            the IpAllowListSourceNotCidr refinement on the entry's source
│   │   │                            (issue #90); subdomain-policy.ts carries no config of its own —
│   │   │                            it holds the renderSubdomainPolicy and domains pair and the
│   │   │                            SubdomainPolicyNeedsDomain refinement a web service and a
│   │   │                            static site both spread (issue #43). Route and Header are not
│   │   │                            shared — only a static site takes them (spec §4.8), so they
│   │   │                            live in static-site.ts with the factory (issue #6), and
│   │   │                            MaintenanceMode lives in web.ts for the same reason, because
│   │   │                            spec §4.8 gives it to a web service alone (issue #43).
│   │   │                            is-cron-expression.ts is not a sub-config either: it holds the
│   │   │                            five-field cron grammar the schedule refinement in cron.ts
│   │   │                            reads, dependency-free and in its own file because the factory
│   │   │                            would otherwise outgrow a screen (issue #89). ip-source.ts is
│   │   │                            the same kind of file: the address grammar the allow-list
│   │   │                            refinement reads, dependency-free because the resources tier
│   │   │                            may import no Node built-in (issue #90)
│   │   ├── web.ts  private-service.ts  worker.ts  cron.ts  static-site.ts  key-value.ts
│   │   │   postgres.ts  env-group.ts   each: the factory, its Config, and its output type
│   │   ├── read-replica.ts          referenceable, deliberately outside BlueprintResource
│   │   └── defaults-provenance.ts   what a defaults scope leaves on a resource it filled: the
│                                    declarations it was created through and the defaults that
│                                    landed, each attributed to the scope that declared it. Inert,
│                                    never emitted, read by validation (issue #13)
│   ├── defaults/                    the withDefaults scope
│   │   ├── resource-defaults.ts     ResourceDefaults/PlanDefaults, one plan key per kind that has
│   │   │                            a plan, the build filter, the deploy trigger and the allow list
│   │   │                            typed by the same declarations a config field takes (issue
│   │   │                            #44), the PLAN_KINDS tuple those keys are read by at runtime,
│   │   │                            and the guards holding both equal to DefaultKey and to
│   │   │                            DEFAULT_FIELDS
│   │   ├── apply-defaults.ts        the kind × field matrix: region and plan never reach a static
│   │   │                            site, no repository field reaches a datastore, and `runtime`
│   │   │                            keeps one off an image source, which is what also keeps the
│   │   │                            build filter and the deploy trigger off it; an allow list
│   │   │                            reaches a web service, a static site and Postgres and never a
│   │   │                            Key Value store, whose config requires the field. A
│   │   │                            per-resource value always wins, and an object or an array
│   │   │                            default is replaced whole rather than merged
│   │   ├── defaults-scope.ts        the nestable scope: the frozen per-scope declaration, derived
│   │   │                            from DEFAULT_FIELDS and PLAN_KINDS so a new default cannot go
│   │   │                            undeclared, the unknown key a JavaScript caller can write, the
│   │   │                            outer-to-inner merge, and the provenance a resource carries
│   │   └── with-defaults.ts         the wiring: each factory applies its rule to the scope's
│                                    values and returns the resource with that provenance
│   ├── blueprint/                   the explicit root and its placement axes
│   │   ├── blueprint.ts  project.ts  environment.ts   all total; none validates
│   │   └── placement.ts             flattens root / projects[].environments[] / ungrouped into one list
│   ├── validation/                  every rule the compiler cannot express
│   │   ├── validate.ts  issue.ts    THE entry, Blueprint → ok(ValidatedBlueprint) | err(...); plus
│   │   │                            ValidationIssue, ValidationCode, ResourcePath, ValidationWarning
│   │   ├── blueprint-invalid.ts     the BlueprintInvalid class — declared at its only producer (§5)
│   │   ├── parse-configs.ts         walks the resource list: which entries are named, which are
│   │   │                            accepted, and the issues the rest produce, each naming the
│   │   │                            defaults scope that supplied the field it sits on or, failing
│   │   │                            that, the first field its rule read, in the rule's own order
│   │   ├── parse-resource.ts        every zod issue one resource's entry, name, config and resolved
│   │   │                            environment produce; the schemas stay beside their factories
│   │   ├── parse-placement.ts       the root, project and environment schemas, for the placement
│   │   │                            axes rather than the resources on them
│   │   ├── translate-schema-issue.ts   one zod issue → ValidationIssues: the unknown-field recovery
│   │   │                            and the source conflict that resource and placement both raise;
│   │   │                            beside it fieldsRead, the fields a refinement read, resolved
│   │   │                            against the config rather than the object it sits on
│   │   ├── describe-names.ts        the quoted "a", "b" and "c" list a diagnostic message reads
│   │   ├── deprecation.ts           the deprecated fields and the sentence each one warns with
│   │   ├── env-key-origins.ts       resolves an imported group by name the way Render does, so the
│   │   │                            group/direct collision and the duplicate key have one reader
│   │   └── rules/                   one pure Blueprint → issues[] file per rule, 25 of them:
│                                     auto-deploy-trigger-on-image-source, branch-disables-previews,
│                                     build-filter-on-image-source, dangling-reference,
│                                     deprecated-field, duplicate-env-key, duplicate-resource-name,
│                                     env-key-collision, extra-field-conflict,
│                                     extra-field-not-in-schema, instances-ignored-by-scaling,
│                                     maintenance-mode-needs-paid-plan, missing-build-command,
│                                     missing-start-command, missing-static-publish-path,
│                                     persistence-needs-paid-plan, preview-value-ignored,
│                                     project-without-environment, resource-in-multiple-locations,
│                                     root-deprecated-field, root-extra-field-conflict,
│                                     secret-skips-previews, unknown-service-env-var-key,
│                                     unused-default, web-only-field. The scaling, numeric-range and
│                                     high-availability families are refinements beside their own
│                                     config instead, because each reads one config and no other
│   ├── synth/                       the ONLY module that knows YAML exists
│   │   ├── synthesize.ts  document.ts   validate → document → emit; ValidatedBlueprint → a Document
│   │   ├── mapping.ts  key-order.ts   the ordered builder that never writes an undefined value (§5),
│   │   │                            and the orders no resource owns: the root, the placement axes,
│   │   │                            the env-var entry forms and the registry-credential nodes. Each
│   │   │                            resource's own field order is the tuple beside its factory
│   │   ├── services.ts              dispatch on resource.kind, then the `services:` sequence
│   │   ├── web-service.ts  private-service.ts  worker-service.ts
│   │   ├── cron-job.ts  static-site.ts  key-value-store.ts
│   │   │                            one emitter per listable service kind, each owning the nested
│   │   │                            branches only it emits — maintenance mode on a web service;
│   │   │                            previews, headers and routes on a static site, which the
│   │   │                            (type, runtime) pair discriminates
│   │   ├── disk.ts  scaling.ts  build-filter.ts  service-previews.ts
│   │   │                            the nested branches several kinds emit: buildFilter on five,
│   │   │                            the other three on web service, private service and worker
│   │   ├── service-source.ts        one source union → the source keys a mapping emits, plus the
│   │   │                            image and registry-credential nodes
│   │   ├── databases.ts             postgres → `databases:`, read-replica registration
│   │   ├── env-vars.ts              map → `envVars:` list, `fromGroup` entries, the five value forms
│   │   ├── env-var-groups.ts        envVarGroups() — envGroup resources → an `envVarGroups:` list (root, environment, ungrouped)
│   │   ├── ip-allow-list.ts         the ipAllowList sequence a web service, a static site,
│   │   │                            Postgres and Key Value all emit
│   │   ├── root-previews.ts         the root `previews:` mapping
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
│       ├── main.ts                  the bin entry and startup: argv, the manifest path, brocli's
│       │                            run() with noExit, the node floor gate, and the ONE isPanic
│       │                            boundary. The exit code run() discards lives here, beside it
│       ├── execute.ts               discover → load → writeBlueprint or checkBlueprint, plus the
│       │                            Outcome it produces and the CliError union it fails with
│       ├── report.ts                the only writer of stdout and stderr and the only decider of
│       │                            exit codes 0/1/2: an outcome, a usage failure, the node floor
│       │                            sentence, the version line, a defect. Stateless — it returns
│       │                            the status rather than assigning it
│       ├── commands.ts              synth and check as brocli command() declarations: --file, --out
│       │                            and --strict as typed option builders, and the help text brocli
│       │                            generates from them (issue #22 replaced parse-arguments.ts)
│       ├── usage-theme.ts           the brocli event handler: detects a usage failure — brocli's own, and the
│       │                            global help it prints for a line that does not ask for help — which
│       │                            report.ts turns into a message; rethrows a defect past brocli's catch
│       ├── run-config.ts            RunConfig extends BroCliConfig with noExit — brocli 0.12.1 reads
│       │                            it at runtime but does not declare it
│       ├── package-version.ts       reads the version out of the manifest beside the built binary,
│       │                            through a FileReader, for brocli's --version
│       ├── discover.ts  load.ts     walk up from cwd for render.ts (--file overrides), then import()
│       ├── node-floor.ts            refuses a Node older than the type-stripping floor with a
│       │                            sentence, rather than letting the loader fail (§7 engines)
│       └── format.ts                human rendering of issues, warnings, and the drift diff
├── test/                            cross-module tests only; unit tests live beside their source
│   ├── fixtures.test.ts             every test/fixtures/*/render.ts → byte-equal render.yaml, then
│   │                                parsed and validated against the Render schema (§6.2, §6.3)
│   ├── enum-conformance.test.ts     every enum tuple against the enum values the schema publishes
│   ├── support/                     not tests: the helpers the suites share
│   │   ├── raised-issues.ts         the reader the config tests share for the issues a schema
│   │   │                            raised through raise(), each with the code it named
│   │   └── render-schema.ts         the compiled conformance oracle of §6.3, shared by the fixture
│   │                                harness and the CLI smoke test; render-schema.test.ts is its
│   │                                own test, that the oracle rejects what Render forbids
│   ├── expectation.ts               not a test: reads a committed expectation, or rewrites it under
│   │                                UPDATE_FIXTURES=1. The one place the update switch is read
│   ├── cli.test.ts                  spawn the binary in a temp dir; assert exit codes 0/1/2 (§6.6)
│   ├── key-order-conformance.test.ts   every emission tuple that names a published definition,
│   │                                against the property order that definition lists them in.
│   │                                SOURCE_FIELDS is not one of them: it is the set of keys the
│   │                                source branches own, not an emission order (issue #12)
│   ├── schema-allow-list-conformance.test.ts   every allow-list tuple against the whole property
│   │                                list its closed definition publishes, and against the
│   │                                additionalProperties (unevaluatedProperties, at the root) that
│   │                                makes that list a constraint rather than a suggestion
│   ├── extra-field-not-in-schema.test.ts   one document per closed definition carrying a key the
│   │                                schema lacks: the warning it draws, the oracle rejecting the
│   │                                same document at the same path, and the control without the key
│   ├── dependency-policy.test.ts    §3.1 itself: extends the real .oxlintrc.json in a temp
│   │                                directory and asserts what each row rejects and admits
│   ├── fixtures/canonical/render.ts   design B §3 verbatim — the scenario every design doc shares
│   ├── fixtures/canonical/render.yaml the golden output. Every test/fixtures/*/render.yaml is
│   │                                rewritable, but only through `pnpm fixtures:update` (§6.2)
│   ├── fixtures/*/render.ts         one directory per scenario; fixtures.test.ts discovers any
│   │                                directory holding a render.ts, so adding one needs no wiring
│   ├── fixtures/cli/                ten seed directories, each holding a render.ts.seed whose
│   │                                import specifier is a placeholder the smoke test rewrites to
│   │                                the built entry's file URL. What sits beside the seed differs:
│   │                                split, v1-1-surface and v1-2-surface add an expected.yaml, the
│   │                                output the run is compared against; clean, drifted and warned
│   │                                add a render.yaml, the committed file `check` reads;
│   │                                build-filter-image, defective, invalid and schema-allow-list
│   │                                hold the seed alone and are judged on exit code and streams.
│   │                                export-not-a-blueprint.mjs and export-without-resources.mjs sit
│   │                                beside the directories, for the two bad-export paths
│   └── schema/render.yaml.schema.json the conformance oracle, refreshed by script only (§6.3)
├── tools/oxlint/anti-slop/          written by the install skill; committed; never linted or edited
├── .githooks/                       pre-commit formats and lints the staged files; commit-msg
│                                    validates the subject. `git config core.hooksPath .githooks`
├── AGENTS.md                        the conventions in force. CLAUDE.md is a symlink to it
├── CONTRIBUTING.md                  the contributor entry: the task-to-owner-to-tests map
├── CONTEXT.md                       the glossary
├── README.md                        the consumer's document
└── .gitignore  .oxfmtrc.json  .oxlintrc.json  LICENSE  package.json  pnpm-lock.yaml
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

Every rule in §3.1 is a rule about an import specifier, so a linter decides it. §3.2 holds the
boundary rules that are about the *form* of a file rather than what it imports; a reviewer decides
those. Nothing else about the layout is policy.

### 3.1 Enforced

**The tiers.** A module may import any module in a tier strictly below its own, and may import its
own files freely. It may not import a module in its own tier, and it may not import anything above
it.

```
  L0   raise.ts · equal.ts                     nothing inside src/
  L1   json.ts · bounded-integer.ts · enums/   imports L0
  L2   references/                             imports L0-L1
  L3   env/                                    imports L0-L2
  L4   resources/                              imports L0-L3
  L5   defaults/ · blueprint/                  imports L0-L4; siblings, never each other
  L6   validation/                             imports L0-L5   ← declares BlueprintInvalid
  L6a  validation/rules/                       a sub-tier: see below
  L7   synth/                                  imports L0-L6   ← the only importer of `yaml`
  L8   fs/                                     imports L0-L7   ← declares the two file errors
  L9   drift/                                  imports L0-L8
  L10  index.ts · testing.ts                   imports L0-L9; the two published entrypoints
  L11  cli/                                    imports index.ts and its own files, nothing else
```

`raise.ts` sits below `json.ts` and `bounded-integer.ts` because both import it; splitting the
foundation in two is what leaves the table with no internal exceptions.

**A module's own files import each other freely** — that is what makes it a module. What is banned
is an import between two sibling modules in one tier, and `defaults/` ↔ `blueprint/` is the only
such pair. `fs/` and `drift/` take a type import of `Blueprint` from L5, and that is legal: it is
the input type of `writeBlueprint` and `checkBlueprint`, and a factory file owns its own contract
(§4), so the type does not move.

**`validation/rules/` is a sub-tier of `validation/`.** A rule imports anything below L6 and any
non-rule file in `validation/`, but never `validate.ts` and never a sibling rule. `validate.ts`
imports every rule. The `validation/` ↔ `validation/rules/` loop that a directory-level reading
sees is not a cycle between files, and is expected.

**The two entrypoints.** `index.ts` publishes `.` and `testing.ts` publishes `./testing`; both are
in `package.json` `exports`. Neither imports the other, and no source file inside `src/` imports
either one except `cli/`, which imports `index.ts`. Test files may, and do: `src/index.test-d.ts`
type-tests both surfaces and `src/cli/discover.test.ts` takes `memoryFilePort` from `testing.ts`.
If a CLI file needs something `index.ts` does not export, export it — do not reach inside.

**External dependencies have owners.**

| Package | Allowed in | Why |
| --- | --- | --- |
| `zod` | L0-L6 only | no schema and no Zod type may cross a published entry (ADR-0003). `scripts/check-declarations.mjs` proves the output half by failing the build if `dist/index.d.ts` names Zod; this ban is the input half |
| `better-result` | `validation/`, `synth/`, `fs/`, `drift/`, `cli/` | banned below `validation/`, which is the mechanical form of "factories are total" |
| `yaml` | `synth/` | `drift/` receives a `JsonValue`, never a string it must parse itself. `test/` may parse the emitted YAML back, which is what §6.3 does |
| `node:fs`, `node:fs/promises` | `fs/`, and any test file | everything above it is pure. The fixture harness, the CLI smoke test and `src/fs/node-file-port.test.ts` read the disk directly |
| `node:path`, `node:url` | `fs/`, `cli/`, and any test file | path arithmetic only. The CLI never touches the disk itself: every read and write goes through the `FilePort` it takes from `index.ts`. Five files under `test/` resolve fixture paths this way |
| any other `node:` builtin | no source file; a test may | `src/fs/node-file-port.test.ts` takes `node:os` for a temp directory |
| `@drizzle-team/brocli` | `cli/` | |
| `ajv`, `ajv-formats` | `test/support/` | the conformance oracle and nothing else |
| `vitest` | test files | |

**Test files.** The tier table and the `zod` and `better-result` rows bind source files only. A unit
test legitimately builds a whole blueprint to exercise its subject, and dozens of tests do:
`src/fs/write-blueprint.test.ts` builds one, `src/validation/*.test.ts` builds resources through
`withDefaults`, `src/resources/web.test.ts` reads raised issues through `test/support/`. What still
binds a `*.test.ts` or a `*.test-d.ts`:

- it may import anything under `src/` and anything under `test/support/`;
- nothing under `src/` may import `test/fixtures/**` — a fixture is consumer-style sample code, not
  a helper;
- no source file may import a test file;
- every other row of the external table applies, with the `test/` exemptions it names.

The exemption is safe because the tier table exists to keep the *shipped* graph acyclic and the
published surface clean, and no test file reaches `dist/`: `tsconfig.json` compiles `include:
["src"]` and tsdown bundles from three entries. It is also why `test/support/raised-issues.ts`
stays outside `src/` — a file under `src/` would ship its Zod types.

**Cycles are rejected everywhere,** source and test, including a cycle that exists only through
`import type`. There are none today at file granularity.

**The gate.** `.oxlintrc.json` encodes every rule above, and `pnpm lint` runs it, so `pnpm check`
and the `pre-commit` hook both fail on a violation. Each rule is one `overrides[]` block keyed on a
`files` glob, the blocks run in tier order, and every message names the tier and points back here.
`test/dependency-policy.test.ts` extends the real config from a temporary directory and asserts
that each block rejects what it forbids and admits what it allows.

**A module is one flat directory.** `synth/document.ts` and `synth/mapping.ts` import each other
freely, but `synth/sub/` would not be part of `synth/`: a subdirectory is a sub-tier, and it needs
its own row in the table above and its own block in the config, the way `validation/rules/` has
both. Until it has them the tier block refuses its imports, its imports of its own module's root
included. That refusal is the signal to write the row — never to negate the module root, and never
to add an exemption.

**A file in no tier is denied by default.** A leading block matching all of `src/**` refuses every
import that leaves the file's own directory, and every external package, so a directory nobody has
classified fails the gate instead of passing unexamined; the block after it holds a new file
directly under `src/` to L0 for the same reason. The fix is a row above and a block in the config,
in that order.

**How to resolve a violation.** The message names the tier the file is in and the tiers it may
import. Move the code to the layer that owns it, or give the importer what it needs from a file
that already sits below it: a value two modules share belongs in the lowest tier both can reach,
and a CLI file that lacks an export asks `index.ts` to export it rather than reaching inside.
Changing the tiers themselves is a change to this section first and to `.oxlintrc.json` second.
Never add an exemption to make a violation go away — the deny-lists carry no exception that is not
written here.

Three notes on how the config encodes this section, so they are not rediscovered:

1. `no-restricted-imports` matches the specifier text, so each per-module block denies `../**` and
   negates the tiers below it by name; `validation/rules/`, the only nested directory in `src/`,
   needs the `../../**` form as well. Two ordering rules govern the rest. Blocks are ordered and the
   last one to match a file wins, which is how the block for colocated test files relaxes the tier
   blocks above it. Inside a block the opposite holds: a negation exempts that specifier from the
   whole rule, whatever group it sits in. A ban that has to outlive a negation — the ban on
   importing a test file has to outlive `!../resources/**`, which matches
   `../resources/web.test.js` — must therefore be the last entry of that same group, never a group
   of its own.
2. `import/no-cycle` needs `ignoreTypes` set to false — its default passes a type-only cycle.
   Naming the `import` plugin also enables `import/default` and `import/namespace`, its two other
   rules in the `correctness` category; the tree passes both.
3. `ajv` is imported as `ajv/dist/2020.js`, so a bare `ajv` pattern will not match it.

What the gate does not see. The block for `src/**/*.test.ts` and `src/**/*.test-d.ts` is one flat
block, so mechanically it keeps only the `ajv` row and the ban on importing a fixture; every other
external row stops binding a colocated test file. Of those, `@drizzle-team/brocli` is the only real
loss, because the rest name a `test/` exemption anyway. Restoring it would mean repeating the
test-file block once per directory, roughly doubling the config to police one package that no test
outside `cli/` imports, so it was not paid for. Separately, a specifier is matched as text, so a
computed `import(variable)` is invisible: `cli/load.ts` loads the author's blueprint that way by
design, and nothing else in `src/` does.

### 3.2 Reviewed by hand

These are boundary rules a reviewer decides, because they are about what a file *is*, not about
what it imports.

- **`index.ts` and `testing.ts` hold no logic** — re-exports only, so the published surface is two
  readable files.
- **`validation/rules/*` are pure functions returning `ValidationIssue[]`.** They never
  short-circuit; `validate.ts` runs all of them and concatenates, because `BlueprintInvalid` must
  carry every problem at once.
- **No file outside `synth/` mentions YAML, quoting, indentation or key order.** `drift/` compares
  values that `synth/` produced.

### Deep modules

| Module | Surface | What it hides |
| --- | --- | --- |
| `synth/` | `synthesize(blueprint)` | YAML serialization entirely, key order, the generated-file header, the six listable service kinds and the one emitter each, the `(type, runtime)` discriminator, the env map→list conversion, the keyless `fromGroup` entry, the `previewPlan`/`previews.plan` split, Postgres landing in `databases:` while Key Value lands in `services:`, read-replica name registration |
| `validation/` | `validate(blueprint)` | 21 rule files, the traversal that reaches every reference in every env map on every resource in every placement, and the ordering that makes issue output deterministic |
| `references/` | property access on a resource value | both YAML reference forms, the `property` XOR `envVarKey` split, and the per-source legality table — nobody writes `fromDatabase`, they write `db.connectionString` |
| `defaults/` | `withDefaults(defaults)` | nesting and the kind × field matrix: region and plan never reach a static site; repo, branch, rootDir, autoDeployTrigger and buildFilter never reach a datastore or an image source; ipAllowList reaches a web service, a static site and Postgres, and never a Key Value store |
| `drift/` | `checkBlueprint(...)` | normalization of the committed file and the classification of changes to Render's immutable fields |

Shallow by design: `enums/`, `json.ts`, `blueprint/`. `cli/` is thin rather than shallow — it
hides nothing from the library, and its own three files split execution from reporting from
startup so each is readable alone.

## 4. Naming conventions

**Files.** kebab-case `.ts`, one primary export named after the file (`with-defaults.ts` →
`withDefaults`). Two exceptions, stated so they are not re-argued: a file may hold sibling
`as const` tuples differing only by resource kind (`enums/plan.ts`), and a factory file owns its
config and output interfaces — one contract, and splitting it buys an import, not a boundary.

**Factories.** camelCase, taking the names design B §2.3 gives them: `web`, `privateService`,
`worker`, `cron`, `staticSite`, `keyValue`, `postgres`, `envGroup`, `blueprint`, `project`,
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
`ResourceInMultipleLocations`, `ExtraFieldConflict`, `EnvKeyCollision`, `ProjectWithoutEnvironment`
— one literal per rule, named after the rule file that produces it. The config tier mints the few
no rule file produces, from the issues a schema raises: `UnknownField`, `InvalidConfig`,
`RootDirNotRelative`, `ConflictingSource` for a key one source branch owns on a config whose
runtime picked another (issue #10), `OutOfRange` for every numeric bound the spec sets,
`ScalingTargetMissing` and `DiskPreventsScaling` for the two pairs a serverService config may not
hold at once (issue #12), `MaintenanceUriNotAbsolute` for a maintenance page the config points at
with something other than an absolute URL, `SubdomainPolicyNeedsDomain` for a
`renderSubdomainPolicy` of `disabled` on a resource that lists no custom domain (issue #43),
`DiskSizeDisallowed` for a database disk size that is neither 1 nor a multiple of 5,
`ScheduleNotCron` for a cron `schedule` that is not the five-field cron expression Render documents
(issue #89), `IpAllowListSourceNotCidr` for an allow-list `source` that is neither an IP address
nor a CIDR range (issue #90), `ScalingRangeInverted` for a scaling range whose `minInstances`
exceeds its `maxInstances`, and `HighAvailabilityUnsupported` for a database that asks for a
standby on a PostgreSQL version before 13 or on a compute plan with less than one CPU.
`WarningCode` follows the same convention one tier down, for a rule that never blocks synthesis —
`SecretSkipsPreviews`, `UnknownServiceEnvVarKey`, `WebOnlyField`, `InstancesIgnoredByScaling`,
`UnusedDefault`, `BuildFilterOnImageSource`, `MaintenanceModeNeedsPaidPlan`,
`AutoDeployTriggerOnImageSource`, `PreviewValueIgnored` and `PersistenceNeedsPaidPlan` among them.

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
(`anti-slop/no-shape-in-symbol-names`). Where "shape" is the natural word — Render's disjoint
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

**6.2 The golden test.** `test/fixtures.test.ts` imports `test/fixtures/canonical/render.ts` — design
B §3 verbatim, the scenario every design document was judged on — calls `synthesize`, and compares
with `test/fixtures/canonical/render.yaml` byte for byte, as it does every other fixture directory.
Three CLI seeds, `split`, `v1-1-surface` and `v1-2-surface`, carry an `expected.yaml` that
`test/cli.test.ts` compares against the built binary's own output the same way; the rest are judged
on exit code and streams, and three of them hold a committed `render.yaml` for `check` to read instead. `pnpm fixtures:update` runs both files under `UPDATE_FIXTURES=1` to regenerate every
`test/fixtures/*/render.yaml` and every `test/fixtures/cli/*/expected.yaml`, and a human reviews the
diff by hand; those are the only files a test may rewrite. This is the single regression net for key
order, quoting, the header and the map→list conversion.

**6.3 JSON Schema conformance.** The same `test/fixtures.test.ts` parses each golden YAML back with
`yaml.parse` and validates it against `test/schema/render.yaml.schema.json`. The validator is
**ajv 8.20.0** with **ajv-formats 3.0.1**, imported as `ajv/dist/2020.js` — the schema declares
`"$schema": "https://json-schema.org/draft/2020-12/schema"` and ajv 8's `2020` build is its draft
2020-12 entry point. `test/support/render-schema.ts` compiles it once and is the only file that
imports either package. The schema is the conformance *floor*, not the spec — requirements.md lists
nine rules it misses — so passing proves the output is not malformed while the unit tests prove it
is correct. `test/schema/render.yaml.schema.json` is the oracle and the only copy any code reads;
`docs/research/raw/render.yaml.schema.json` stays frozen as the 2026-09-05 snapshot.
`pnpm schema:refresh` runs `scripts/refresh-render-schema.mjs`, which downloads from the `$id` in
the file — `https://render.com/schema/render.yaml.json` — and overwrites the test copy only, as a
reviewed commit whose diff is the point. INFERRED: that `$id` is not confirmed to serve the schema
over HTTP.

**6.4 Type tests.** `src/**/x.test-d.ts` and `test/**/*.test-d.ts`, run by `vitest run
--typecheck.only` against `tsconfig.check.json`, `@ts-expect-error` for
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
formatting. Since issue #22 it also asserts what the command line itself owes the caller: a usage
error exits 1 with the offender on stderr, `--help` names both commands and all three flags,
`--version` prints what the manifest says, and the `defective` seed — a resource list that throws
when it is read — proves a Panic escapes brocli's catch, is reported, and exits non-zero. ADR-0002 fixes the CLI's contract at exactly this. It builds the binary itself in
`beforeAll`, so it can never pass against a stale `dist/` and `pnpm check` stays self-contained.

**6.6 `pnpm check`** is the one command CI and agents run:
`oxfmt --check && oxlint && tsc -p tsconfig.check.json && vitest run && vitest run
--typecheck.only`. Format first, because it is instant and its failures are noise in every later
diff. `pnpm build` runs tsdown and then `scripts/check-declarations.mjs`, which fails if
`dist/index.d.ts` names a Zod type.

## 7. Tooling files

The skeletons came from `docs/research/toolchain.md` lines 553-711. Every row below is the file as
it stands, and the manifest that follows it is the manifest.

| File | Content |
| --- | --- |
| `tsconfig.json` | The skeleton verbatim: `target`/`lib` es2023, `module`/`moduleResolution` nodenext, `types: ["node"]`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, **`isolatedDeclarations`**, `erasableSyntaxOnly`, `declaration` + `declarationMap` + `sourceMap`, `outDir: "dist"`, `rootDir: "src"`, `skipLibCheck`, `include: ["src"]`. The two UNSURE options (`allowImportingTsExtensions`, `composite`) stayed out. |
| `tsconfig.check.json` | Extends it with `noEmit`, `rootDir: "."` and `include: ["src", "test"]`, so the gate type-checks the tests the build never emits. |
| `.oxlintrc.json` | `plugins: ["typescript","unicorn","oxc"]`, `categories.correctness: "error"`, the `jsPlugins` entry pointing at `./tools/oxlint/anti-slop/index.ts`, and all 15 `anti-slop/*` rules at `"error"`. `anti-slop-effect` stays omitted — no direct `effect` dependency. `ignorePatterns` covers the agent directories, `.reference/**`, `dist/**`, `docs/**`, `test/schema/**` and `tools/oxlint/anti-slop/**`. `test/fixtures/**` is **not** ignored: the fixtures are consumer-style code, and holding them to the same rules is what proves the rules are livable. |
| `.oxfmtrc.json` | `printWidth` 100, `tabWidth` 2, `semi`, **single quotes**, `trailingComma: "all"`, `sortImports: true`, `sortPackageJson: true`. `ignorePatterns` covers the agent directories, `.reference/**`, `dist/**`, `docs/**`, `test/fixtures/**/*.yaml`, `test/schema/**`, `tools/oxlint/anti-slop/**`, `pnpm-lock.yaml`, `CLAUDE.md` and `CONTEXT.md`. oxfmt formats Markdown, so `AGENTS.md`, `README.md` and `CONTRIBUTING.md` go through it and the documents under `docs/` do not. |
| `vitest.config.ts` | `test.include: ["src/**/*.test.ts","test/**/*.test.ts"]`, `test.typecheck.include: ["src/**/*.test-d.ts","test/**/*.test-d.ts"]`, `test.typecheck.tsconfig: "tsconfig.check.json"`. INFERRED — the toolchain doc verifies vitest 5 with `--typecheck` but ships no config skeleton. |
| `tsdown.config.ts` | `entry: { index: "src/index.ts", testing: "src/testing.ts", cli: "src/cli/main.ts" }`, `format: "esm"`, `fixedExtension: false`, `dts: true`, `treeshake: { moduleSideEffects: false }`, `deps: { neverBundle: ["@drizzle-team/brocli", "yaml", "better-result", "zod"] }`, shebang on the `cli` entry. `fixedExtension: false` is required: tsdown 0.23 defaults it to true on the node platform and emits `.mjs` and `.d.mts`, which `exports`, `bin`, and CI would not find (verified in PR #15). `neverBundle` is mandatory — the default bundles dependencies and the toolchain doc measured 234 kB of `yaml` inlined. |
| `.github/workflows/ci.yml` | `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, then `node dist/cli.js --help` as a smoke test that the built binary starts. |
| `.github/workflows/test.yml` | `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm test:types` — the two suites on their own, so a failing test is legible without reading past a format or lint failure. |
| `.githooks/` | `pre-commit` formats the staged files with oxfmt, re-stages them, and runs oxlint on the staged source. `commit-msg` validates the Conventional Commits subject. Git does not version hooks, so each clone runs `git config core.hooksPath .githooks` once. |
| `.gitignore` | Covers `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.reference/`. |

```jsonc
{
  "name": "render-blueprint",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./testing": { "types": "./dist/testing.d.ts", "default": "./dist/testing.js" }
  },
  "bin": { "render-blueprint": "dist/cli.js" },
  "files": ["dist"],
  "engines": { "node": ">=22.18.0" },
  "devEngines": { "runtime": { "name": "node", "version": "^22.18.0 || ^24.11.0 || >=26.0.0" } },
  "packageManager": "pnpm@10.33.4",
  "dependencies": { "@drizzle-team/brocli": "0.12.1", "better-result": "3.0.1",
    "yaml": "2.9.0", "zod": "4.5.4" },
  "devDependencies": { "@oxlint/plugins": "1.81.0", "@types/node": "26.4.1", "ajv": "8.20.0",
    "ajv-formats": "3.0.1", "oxfmt": "0.66.0", "oxlint": "1.81.0", "tsdown": "0.23.0",
    "typescript": "7.0.2", "vitest": "5.0.0" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "test": "vitest run",
    "test:types": "vitest run --typecheck.only",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:types",
    "build": "tsdown && node scripts/check-declarations.mjs",
    "schema:refresh": "node scripts/refresh-render-schema.mjs",
    "fixtures:update": "UPDATE_FIXTURES=1 vitest run test/fixtures.test.ts test/cli.test.ts",
    "prepublishOnly": "pnpm check && pnpm build"
  }
}
```

**Two export paths, both re-exports only.** `.` is the library and `./testing` publishes
`memoryFilePort` alone, so a consumer's runtime bundle never carries the in-memory port. There is
no third: a deep import into `dist/` is what a re-export-only surface avoids, and `bin` is a
binary, not an import path. Every dependency is pinned exactly; `oxlint` and `@oxlint/plugins` must
stay equal, and vitest exact because `--typecheck` is experimental.

## 8. Not settled here

Design B §9's nine open decisions stay open; none changes the layout. The three that touch code
soonest: `fromGroup` emission order (§9.2 — `key-order.ts` picks one, the golden test freezes it),
whether `KeyValueReference.host`/`.port` survive (§9.3), and `withDefaults` conflict semantics
(§9.6 — one branch in `apply-defaults.ts`).

---

## Codebase conventions

They live in `AGENTS.md`, which is the file in force; `CLAUDE.md` is a symlink to it. This document
explains why each one exists, `AGENTS.md` states it, and `CONTRIBUTING.md` says which one a given
task touches.
