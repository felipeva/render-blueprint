# IaC DX survey — TypeScript in, YAML out

Research date: 2026-09-05. Purpose: inspire a library that lets users describe Render.com
resources in TypeScript and generate a `render.yaml` blueprint.

Everything quoted below is verbatim from the cited source unless labelled **INFERRED**.
Anything labelled **INFERRED** is my own judgement, not a claim about the tool.

---

## 1. Railway Infrastructure as Code (primary target)

Railway shipped a TypeScript-authored IaC system in 2026. It is by far the closest
precedent for what we want: a `.ts` file describing a whole hosting project, evaluated by
a CLI, diffed against live state.

Sources:
- https://docs.railway.com/infrastructure-as-code
- https://docs.railway.com/infrastructure-as-code/reference
- https://docs.railway.com/cli/config
- https://github.com/railwayapp/railway-ts-sdk (npm package `railway`, entrypoint `railway/iac`)
- https://github.com/railwayapp/railway-skills/blob/main/plugins/railway/skills/use-railway/references/iac.md
- https://docs.railway.com/reference/variables
- https://docs.railway.com/reference/config-as-code (the deprecated predecessor)

### 1.1 The two-system split (important framing)

| Feature | Scope | File |
| --- | --- | --- |
| Config as Code | One service deployment | `railway.json` or `railway.toml` |
| Infrastructure as Code | A Railway project/environment | `.railway/railway.ts` |

> "Config as Code is read from your service repository during deploy. It overrides
> dashboard values for that service.
>
> Infrastructure as Code is evaluated by the Railway CLI. The CLI compares
> `.railway/railway.ts` with the selected Railway environment, shows the changes it would
> make, and applies those changes only after confirmation."
> — https://docs.railway.com/infrastructure-as-code

Railway explicitly forbids dual ownership: "A service cannot be managed by both systems at
the same time." `railway config plan` hard-stops and names the service that must be
migrated. Config as Code is now deprecated with a hard cutoff of 2026-12-01.

**Note for us:** Render's `render.yaml` is architecturally the *Config as Code* file —
declarative, read by the platform, one file for the whole project. Our library sits one
level above it and emits it. Railway's IaC layer *replaces* their YAML/JSON rather than
generating it, so their "no state file, diff against live" model is a design choice we can
copy or reject independently of the DSL shape. **INFERRED.**

### 1.2 The minimal file, verbatim

```ts
import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web");

  return project("my-project", {
    resources: [web],
  });
});
```

The scaffolded version from `railway config init`:

```ts
import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    build: "pnpm build",
    start: "pnpm start",
  });

  return project("my-app", {
    resources: [web],
  });
});
```

### 1.3 The full example, verbatim

From https://docs.railway.com/infrastructure-as-code/reference ("Larger example"):

```ts
import {
  bucket,
  defineRailway,
  github,
  group,
  postgres,
  preserve,
  project,
  redis,
  service,
  volume,
} from "railway/iac";

export default defineRailway((ctx) => {
  const prod = ctx.environment === "production";

  const db = postgres("postgres");
  const cache = redis("redis");
  const uploads = bucket("uploads", { region: "iad" });
  const workerData = volume("worker-data", {
    region: "us-west2",
    sizeMB: 1024,
  });

  const api = service("api", {
    source: github("acme/monorepo", { rootDirectory: "apps/api" }),
    build: "pnpm --filter api build",
    start: "pnpm --filter api start",
    healthcheck: "/health",
    replicas: prod ? { "us-west2": 2, "europe-west4": 1 } : 1,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      JWT_SECRET: preserve(),
    },
  });

  const web = service("web", {
    source: github("acme/monorepo", { rootDirectory: "apps/web" }),
    build: "pnpm --filter web build",
    start: "pnpm --filter web start",
    domains: prod ? ["app.example.com"] : [],
    env: {
      API_HOST: api.env.RAILWAY_PRIVATE_DOMAIN,
    },
  });

  const worker = service("worker", {
    source: github("acme/monorepo", { rootDirectory: "apps/worker" }),
    build: "pnpm --filter worker build",
    start: "pnpm --filter worker start",
    volumeMounts: {
      "/data": workerData,
    },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
    },
  });

  const backend = group("Backend", [db, cache, api, worker]);
  const storage = group("Storage", [uploads, workerData]);

  return project("acme", {
    resources: [backend, storage, web],
  });
});
```

### 1.4 Primitives

From the SDK README, "The DSL in brief":

> - Resources: `service`, `fn` (cron), `postgres` / `mysql` / `redis` / `mongo`, `bucket`,
>   `group`.
> - Sources: `github(repo)`, `image(ref)`, `template(name)`, `empty()`.
> - Variables: literals, typed references to another resource (`db.env.DATABASE_URL`),
>   shared variables (`ctx.shared.NAME`), and `preserve()` to keep a value Railway already
>   holds.
> - Per-environment logic via the context: `ctx.isEnvironment("production")`,
>   `ctx.environment`.

Everything is a **lowercase factory function**, not a class and not a `new`. Every factory
takes `(name, config?)` where `name` is the user-visible Railway name — not a slug, not an
id:

> "Service names should match the names users see in Railway. Names with spaces are valid"

```ts
const docsFrontend = service("Docs Frontend", {
  source: github("acme/docs"),
});
```

Sources are themselves factories, so `source` is a tagged union expressed as a call rather
than a discriminated object literal:

```ts
const web = service("web", { source: github("owner/repo", { branch: "main" }) });
const worker = service("worker", { source: image("ghcr.io/acme/worker:latest") });
```

`source` is optional — omit it and the file manages settings without claiming ownership of
where the code comes from.

Volumes are separate resources mounted by path, and the mount is a plain object keyed by
container path:

```ts
const data = volume("backend-data", { region: "us-west2", sizeMB: 1024 });

const backend = service("backend", {
  start: "node server.js",
  volumeMounts: { "/data": data },
});
```

`group(name, resources[])` is purely presentational ("Groups are structural. They make
large projects easier to scan in both `.railway/railway.ts` and the Railway canvas.") but
it also nests in the `resources` array, so the returned tree is a *tree*, not a flat list.

### 1.5 Cross-resource references — the single best idea here

The reference syntax on the platform is a string template: `${{NAMESPACE.VAR}}`, e.g.
`${{Postgres.DATABASE_URL}}`, `${{shared.API_KEY}}`, `${{api.RAILWAY_PRIVATE_DOMAIN}}`
(https://docs.railway.com/reference/variables). Service names in these references are
case-sensitive and must match exactly.

The DSL **never asks the user to write that string**. Every resource exposes a typed
`.env` proxy, and the compiler turns the property access into the interpolation:

```ts
const db = postgres("postgres");

const web = service("web", {
  env: {
    DATABASE_URL: db.env.DATABASE_URL,
  },
});
```

```ts
const worker = service("worker", {
  source: image("ghcr.io/acme/worker:latest"),
  env: {
    API_HOST: api.env.RAILWAY_PRIVATE_DOMAIN,
    API_TOKEN: api.env.INTERNAL_TOKEN,
  },
});
```

Shared (project-level) variables come off the context, and the docs are explicit that this
is a *reference*, not a definition:

```ts
export default defineRailway((ctx) => {
  const web = service("web", {
    env: {
      SENTRY_DSN: ctx.shared.SENTRY_DSN,
    },
  });

  return project("my-project", { resources: [web] });
});
```

> "`ctx.shared.NAME` compiles to `${{shared.NAME}}`. It points at an existing shared
> variable on the environment; it does not define or manage the shared variable itself."

The agent-facing skill states the rule as a hard constraint: "Use `service.env.VARIABLE`
and `database.env.VARIABLE` for references." and "Prefer product DSL names such as
`domains`, `replicas`, and `group`; avoid internal names such as `customDomains` and
`multiRegionConfig`."

### 1.6 Secrets

Three distinct answers, which is more nuance than most tools:

1. **Literal** — `NODE_ENV: "production"`. Fine for non-secrets.
2. **`preserve()`** — a sentinel meaning "keep the value that is already set in Railway."
   > "`preserve()` is mainly used for imported secrets whose values are not available to
   > the CLI."
3. **`ctx.shared.NAME`** — point at a project-level variable managed outside the file.

Plus platform-level *sealed* variables, which "cannot be un-sealed", are never returned by
the API, and stay as `preserve()` on import.

Import defaults are secret-safe: `railway config pull` "omits encrypted secrets unless it
must include `preserve()` to avoid overwriting an existing value", and inlining real values
is an explicit opt-in that prints a warning:

> "`--include-variables` writes non-sealed values, including secrets that were never
> sealed, into `.railway/railway.ts`. The CLI prints a warning when you use it. Sealed
> variables stay as `preserve()`."

Plan output redacts by default: values show as `«hidden»` unless `--show-values` is passed.

### 1.7 Workflow: init / pull / plan / apply / migrate

| Command | Description |
| --- | --- |
| `railway config init` | Create Railway configuration files for the current directory. |
| `railway config pull` | Import the linked Railway project's current configuration into `.railway/railway.ts`. |
| `railway config plan` | Preview changes without applying them. |
| `railway config apply` | Preview and apply changes after confirmation. |
| `railway config migrate` | Convert Config as Code into IaC (`--lang ts` \| `py` \| `go`). |

Plan output is deliberately Terraform-shaped:

```
Railway configuration
Using .railway/railway.ts
Environment production

Plan: 1 to add, 0 to change, 0 to destroy
  + Create service web

Next
  • Run railway config apply to apply these changes.
```

A clean re-import prints `Your Railway configuration is already up to date.`

Safety mechanics worth stealing wholesale:

- **No state file.** "Your `.railway/railway.ts` is diffed against the *live* environment —
  there is no state file to manage or drift from." (SDK README)
- **Stale-plan rejection.** "Railway runs a fresh plan immediately before applying and
  commits against the exact environment state it just read. If the environment changed in
  between … the apply is rejected." Surfaced as a typed `StaleEnvironmentError`.
- **Two-key destruction.** `--yes` alone is not enough: "Non-interactively (with `--yes`,
  `--json`, or in an agent session), destructive changes additionally require
  `--confirm-destructive`, so a stray `--yes` cannot remove resources on its own."
- **CI drift gate.** `--detailed-exit-code` exits `0` for no changes and `2` for pending
  changes; opt-in so the default exit behaviour is unchanged.
- **Pinned plan artifact for CI**, so merge applies the reviewed plan rather than re-planning:

```bash
railway config plan --out railway-plan.json
railway config apply --plan railway-plan.json --yes --confirm-destructive
```

> "Apply fails if the live environment etag no longer matches, or if the checked-out
> `.railway/` tree is not the planned tree."

- **File discovery walks up** from cwd to parent directories; `--file` overrides. "Prefer
  one configuration file per project. Named partials are a last resort for split
  repositories, not the default."

### 1.8 Import is a first-class, human-oriented product

> "The importer generates code intended to be edited by humans. It keeps user-facing names,
> omits platform defaults, leaves out generated Railway domains, avoids internal IDs, and
> omits encrypted secrets unless it must include `preserve()`."
> — https://docs.railway.com/infrastructure-as-code

`railway config pull --agent` "Print[s] a suggestion to ask an agent to turn imported state
into idiomatic TypeScript" — i.e. Railway concedes the importer produces literal code and
routes the beautification step to an LLM rather than trying to be clever.

And `init`/`pull` write agent instructions next to the config:

```
.railway/railway.ts
.railway/README.md
.agents/skills/railway-config/SKILL.md
```

> "These files help teammates and agents understand how to edit the Railway configuration
> safely."

### 1.9 Stated DX goals

The clearest statement of intent is in Railway's own agent skill, rule 1:

> "Express Railway product intent, not internal API details."

Followed by: no UUIDs in source, no internal type names (`EnvironmentConfigPatch`,
`ServiceInstance`, "Backboard internals"), no generated platform domains, "Do not add
platform defaults unless the user explicitly wants them", and "Keep secrets out of source."

The docs are also honest about the experimental surface: "Generated `.railway/railway.ts`
formatting may change while the DSL is experimental."

---

## 2. Comparators

### 2.1 cdk8s — the closest analog (TS constructs → Kubernetes YAML)

Sources: https://cdk8s.io/docs/latest/, /basics/app/, /basics/chart/, /basics/api-object/,
/cli/synth/

```ts
import { App } from 'cdk8s';

// create the app entry-point
const app = new App();

// register charts to the app
new MyChart(app, 'Chart');

// synthesize the app
app.synth();
```

```ts
class MyChart extends Chart {
  constructor(scope: Construct, ns: string) {
    super(scope, ns, {
      namespace: 'my-namespace',
      labels: { app: 'my-app' },
    });

    new ApiObject(this, 'my-object', { apiVersion: 'v1', kind: 'Foo' });
  }
}
```

- **Three-level tree with a hard synth boundary.** `App` → `Chart` (one manifest file each)
  → constructs → `ApiObject`. Nothing touches a cluster: "cdk8s apps only define Kubernetes
  applications, they don't actually apply them to the cluster." Output lands in `dist/` and
  is applied by `kubectl` or Flux. This is exactly our "TS in, YAML out" boundary.
- **Every child takes `(scope, id, props)`.** Identity is *positional in the tree*, not the
  resource's real name — and the real name is then *derived* from the tree path plus a hash:
  `my-chart-deployment-c8c354dd`. `disableResourceNameHashes: true` removes the hash but
  the docs immediately warn about collisions when ids contain hyphens.
- **Chart-level defaults cascade** to every object beneath (`namespace`, `labels`). Cheap,
  very useful, and something `render.yaml` has no equivalent of.
- **Output shape is configurable at the root**, not per-resource: `outdir`,
  `outputFileExtension`, `yamlOutputType: FILE_PER_RESOURCE`.
- **Validation is a synth-time plugin system**, configured in `cdk8s.yaml` (`validations:`
  with package/class/version), reports violations by *construct path* as well as file
  line, and fails `cdk8s synth` on failure. Validation is deliberately not in the
  constructors.
- **Resolvers** are a last-mile escape hatch: an `IResolver` visits every value just before
  it is written to YAML and can `replaceValue`. Handy, and also a warning — it exists
  because the typed API could not express everything.

### 2.2 Pulumi TypeScript — `Input<T>` / `Output<T>`

Source: https://www.pulumi.com/docs/iac/concepts/inputs-outputs/

```typescript
const password = new random.RandomPassword("password", {
    length: 16,
    special: true,
    overrideSpecial: "!#$%&*()-_=+[]{}<>:?",
});
const example = new aws.rds.Instance("example", {
    instanceClass: "db.t3.micro",
    allocatedStorage: 64,
    engine: "mysql",
    username: "someone",
    password: password.result, // We pass the output from password as an input
});
```

- **`Output<T>` is a promise-like wrapper for "known only after create"**, and passing one
  as another resource's input *is* the dependency edge: "Pulumi uses inputs and outputs to
  automatically keep track of the dependencies between your resources."
- **`Input<T>` accepts the plain type**, so `string` works anywhere `Input<string>` is
  wanted. The asymmetry (plain in, wrapped out) is the whole ergonomic trick.
- **Outputs are viral and cannot be `console.log`'d** — you need `.apply`, `all`, or
  `pulumi.interpolate`. This is the tax for real async resolution.
- Three separate identities per resource — logical name (what you type), URN (internal),
  physical id (what you pass around) — and the docs concede this is "the most common
  type-mismatch error" source.
- **Relevance to us: we do not need `Output<T>`.** Nothing in a `render.yaml` generator is
  async — every reference resolves to a name we already know at author time. Borrowing
  `Output` would import all of the tax and none of the benefit. **INFERRED.**

### 2.3 SST v3 (Ion) — `sst.config.ts`

Sources: https://sst.dev/docs/reference/config/, https://sst.dev/docs/linking/

```ts
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "my-sst-app",
      home: "aws",
      removal: input.stage === "production" ? "retain" : "remove"
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("MyBucket");
    return { bucket: bucket.name };
  }
});
```

```ts
const bucket = new sst.aws.Bucket("MyBucket");

new sst.aws.Nextjs("MyWeb", {
  link: [bucket]
});
```

- **Two phases in one exported object.** `app(input)` is metadata evaluated at load and
  "You cannot define any components or resources in the `app` function"; `run()` is the
  async body where resources exist. A clean way to separate "what is this project" from
  "what is in it", and `input.stage` is available to the metadata phase.
- **Linking beats stringly-typed wiring.** `link: [bucket]` grants permission, injects the
  values, *and* generates `sst-env.d.ts` so runtime code does `Resource.MyBucket.name`
  typed. The list-of-resources prop shape is very readable.
- **No imports in the config file** — "Since SST manages importing your provider packages,
  it's recommended not to add any imports in your `sst.config.ts`" — and globals (`$config`,
  `$app`) instead. Buys terseness at the cost of a magic ambient environment and a
  `/// <reference>` comment.
- **Stage/environment logic is plain TS ternaries** on `input.stage`, same as Railway's
  `ctx.environment`. Nobody in this survey invented a declarative override language.
- **`sst.Linkable` / `Linkable.wrap`** is the extensibility seam: wrap a foreign resource
  class and declare which properties become links. Good model for "let users teach the
  library about a Render field we don't model yet."

### 2.4 Alchemy — async-function resources

Sources: https://alchemy.run/what-is-alchemy, https://alchemy.run/infrastructure-as-code/resource,
https://alchemy.run/blog/2025-07-01-how-alchemy-is-different/, https://github.com/alchemy-run/alchemy

Alchemy has *changed shape* between v1 (2025) and now (2026). Both are instructive.

**v1, the pitch that made it notable** — "Alchemy simplifies the entire stack down to pure
async functions":

```typescript
const app = await alchemy("my-app");

const database = await D1Database("db", { name: "my-database" });

const worker = await Worker("api", {
  entrypoint: "./src/index.ts",
  bindings: { DB: database }        // pass the resource itself, not its id
});

console.log(worker.workerName); // string — immediately available, not Output<string>

await app.finalize();
```

Custom resources were "a simple function that implements create, update, and delete":

```typescript
export const Database = Resource(
  "myservice::Database",
  async function (this: Context<Database>, id: string, props: DatabaseProps): Promise<Database> {
    if (this.phase === "delete") { return this.destroy(); }
    else if (this.phase === "update") { return { id: "db-123", ...props }; }
    else { return { id: "db-123", ...props }; }
  }
);
```

**Current (v2, "Infrastructure-as-Effects")** — resources are Effects yielded into a Stack:

```typescript
export default Alchemy.Stack(
  "MyApp",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const bucket = yield* Bucket;
    const worker = yield* Worker;
    return { url: worker.url };
  }),
);
```

- **`await` as the resource operator** (v1) gives you real values immediately — no
  `Output<T>`, no `.apply`. It works because Alchemy calls APIs directly with `fetch`
  during the run. It also means the file has side effects on import, which is the opposite
  of what a synth-to-file tool wants. **INFERRED: for us this is a cautionary tale, not a
  model — our "resources" are pure data and should never be `await`ed.**
- **Declaration is separable from registration.** `const Bucket = Cloudflare.R2.Bucket("Bucket")`
  is "just a value" you can export from `src/bucket.ts` and import anywhere; nothing happens
  until it is yielded into a Stack. That decoupling is directly copyable and very good for
  monorepos.
- **Logical ID is the first positional argument** across both versions, same as cdk8s,
  Pulumi, SST, and Railway. This is a genuine industry convention.
- **Orphan cleanup by omission**: "If you remove a resource from your script, it will be
  automatically deleted on the next run." Fine for an applier; dangerous framing for a
  generator.
- The v1 → v2 rewrite is itself the lesson: a low-ceremony async-function API grew into an
  Effect program once it needed typed errors, dependency ordering, and cycles. **INFERRED:
  a `render.yaml` generator will never need any of that, so it should stay at the v1 level
  of ceremony — or below.**

### 2.5 Encore.ts — briefly, and mostly to reject

Source: https://encore.dev/docs/ts/primitives/services

```ts
// encore.service.ts
import { Service } from "encore.dev/service";

export default new Service("my-service");
```

"Infrastructure from code": the presence of a file *in a directory* defines a service and
the directory tree is the boundary. Zero config, and the parser derives infra from
application source. Not applicable to us — we are generating config for code we do not
parse — but the naming idea (a file's location implies the resource's identity) is worth a
thought for monorepo layouts. Skipped Dagger and Vercel: neither is a TS→YAML generator.

---

## 3. Patterns to borrow

| Pattern | Who does it | Why it fits a TS → `render.yaml` generator |
| --- | --- | --- |
| Typed cross-resource references instead of strings (`db.env.DATABASE_URL`) | Railway; Pulumi (`password.result`); Alchemy Outputs | `render.yaml` uses `fromDatabase: {name, property}` and `fromService: {name, type, envVarKey}` — pure name-based lookups the compiler can verify. A rename should be a type error, not a silent broken deploy. This is the highest-value single feature. |
| Synth to a file, never touch the platform | cdk8s (`app.synth()` → `dist/`) | Keeps the library testable, offline, and reviewable in a PR diff. Render already applies `render.yaml` itself; we do not need an applier. |
| Declaration separable from registration (a resource is a plain value you can export/import) | Alchemy; Railway (`const db = postgres(...)` then `resources: [db]`) | Monorepos want `apps/api/render.ts` to export its own service and a root file to assemble them. Requires resources be inert data with no construction side effects. |
| Explicit `resources: [...]` collection at the root | Railway | Makes "declared but not included" a visible mistake, and lets `group()`-style nesting exist without a hidden global registry. cdk8s's implicit `scope` registration is the alternative and is harder to reason about. |
| One factory per resource type, `(name, config)` | Railway (`service`, `postgres`, `bucket`, `volume`) | Maps 1:1 onto `render.yaml`'s `type:` discriminator without making the user write `type: "pserv"`. Names go in the same slot as YAML `name:`. |
| Sources/variants as factory calls, not discriminated literals (`github(...)`, `image(...)`) | Railway | Render has `repo`+`branch`+`rootDir`, `runtime: docker` + `dockerfilePath`, and `runtime: image` + `image.url`. Three factories beat one 20-field optional bag. |
| The name you type *is* the platform-visible name | Railway ("Names with spaces are valid") | `render.yaml` names are user-visible and referenced by `fromService.name`. Do NOT derive names from tree paths + hashes. |
| Environment/stage differences as plain TS ternaries on a context arg | Railway (`ctx.environment`); SST (`input.stage`) | Render has previews and `projects[].environments[]`. `previewPlan`, `previews.plan`, `previews.numInstances` are already "the preview override" fields — a `ctx` arg maps cleanly, and nobody has to learn an override DSL. |
| Distinct sentinels for "secret lives elsewhere" | Railway `preserve()`, sealed vars | `render.yaml` has three of these: `sync: false` (prompt in dashboard), `generateValue: true` (Render generates), `fromGroup:` (env group). They deserve three named helpers, not three magic booleans. |
| Redact secret values in any diff/preview output | Railway (`«hidden»`, `--show-values` opt-in) | If we ever print a diff of old vs new `render.yaml`, values must be masked by default. |
| Validation at synth, reported by author-path | cdk8s validation plugins + construct paths | Constructor-time throwing gives worse errors (one at a time, no cross-resource checks). Collect at synth: dangling `fromService` targets, duplicate names, `cron` without `schedule`, `keyvalue` without `ipAllowList`. |
| Two-phase config: metadata function + resources function | SST (`app()` / `run()`) | `render.yaml` has genuine root-level metadata (`previews.generation`, `previews.expireAfterDays`, `projects`) that is not a resource. Worth its own slot. |
| Diff/plan framing with a Terraform-shaped summary | Railway (`Plan: 1 to add, 0 to change, 0 to destroy`) | Even a pure generator benefits from `--check` in CI: regenerate, diff against the committed `render.yaml`, exit non-zero on drift. Copy `--detailed-exit-code` semantics (0 = clean, 2 = drift). |
| An importer that produces human-editable code, not a faithful dump | Railway `config pull` (omits defaults, ids, generated domains) | A `render.yaml` → TS importer is the single best adoption ramp. Same rules apply: keep names, drop platform defaults. |
| Ship agent/teammate instructions alongside the generated file | Railway (`.railway/README.md`, `.agents/skills/.../SKILL.md`) | Cheap, and the tool will be edited by LLMs at least as often as by humans. |
| Chart-level cascading defaults | cdk8s (`namespace`, `labels` on `Chart`) | `region`, `plan`, `branch`, `autoDeployTrigger`, `repo` repeat across every Render service. A defaults scope would remove most of the noise in a real blueprint. |
| A last-mile escape hatch over the emitted document | cdk8s resolvers; SST `Linkable.wrap` | Render adds fields faster than we can model them. Something like `raw({...})` merged into the emitted object, or a post-synth transform, prevents the library from becoming a ceiling. |

## 4. Patterns to avoid

1. **`Output<T>` / promise-wrapped values.** Pulumi and Alchemy need them because resource
   attributes are genuinely unknown until an API call returns. Nothing in a `render.yaml`
   is unknown at author time — every reference is a name the user wrote. Importing
   `Output<T>` would force `.apply()` and `interpolate` on users for zero benefit.
2. **Auto-generated names derived from tree path + hash.** cdk8s produces
   `my-chart-deployment-c8c354dd`. Render service names are user-visible, appear in
   `onrender.com` subdomains, and are the join key for `fromService.name` — they must be
   stable and human-chosen. cdk8s's own docs warn that turning hashes off reintroduces
   collisions; that whole trade-off is one we should never enter.
3. **`await` on resource construction (Alchemy v1).** Makes the config file effectful on
   import, forbids top-level static analysis, and makes `defineBlueprint` unable to be a
   pure function. Our resources must be plain values.
4. **Effect / generator-based authoring (Alchemy v2).** `yield*` everywhere buys typed
   errors and dependency ordering. We need neither, and it puts a large learning curve in
   front of a user whose actual goal is "stop hand-editing YAML".
5. **Ambient globals and no imports (SST's `$config`, `$app`).** Requires a generated
   `.d.ts` and a `/// <reference>` line, breaks plain `tsc` on a fresh checkout, and makes
   the file hard to unit-test. Explicit imports cost one line and are worth it.
6. **Implicit registration via a `scope` argument (cdk8s `new X(this, 'id')`).** Every
   resource silently mutates a parent. It makes "is this resource actually in the output?"
   unanswerable by reading one expression. Railway's explicit `resources: [...]` is
   clearer.
7. **Two config systems for one platform.** Railway shipped Config as Code and then IaC and
   now has to run a deprecation, a migration command, and a hard block on dual ownership.
   If we generate `render.yaml`, we should own it completely — including a header comment
   saying "generated, do not edit" — and never support "partially generated" files.
8. **Class inheritance as the extension mechanism (`extends Chart`).** Users will subclass
   to share defaults, and subclass hierarchies are where CDK-family APIs go to die. Prefer
   plain functions returning resource objects for reuse.
9. **Leaking platform-internal field names.** Railway's rule — "avoid internal names such
   as `customDomains` and `multiRegionConfig`" — is right, but note the inverse risk for
   us: because our output *is* `render.yaml`, renaming fields makes the mapping opaque.
   **INFERRED: default to Render's own field names (`healthCheckPath`, `buildCommand`,
   `envVars`) and only rename where the YAML name is actively bad** (e.g. `pserv`,
   `numInstances`, `sync: false`).
10. **A state file.** Railway explicitly has none and is better for it. We emit a file that
    is itself the state; a lockfile or `.render/state.json` would be pure liability.

---

## 5. Candidate API shapes

**These are sketches for discussion, not proposals.** None are implemented; all three
target the same `render.yaml` (a web service, a Postgres DB, a key-value store, a worker,
one env group). Field names below are real `render.yaml` fields
(https://render.com/docs/blueprint-spec).

### (a) Plain typed object literal + `defineBlueprint({...})`

Closest to the YAML. Zero new concepts; the type system is the whole product.

```ts
import { defineBlueprint, fromDatabase, fromService, secret } from "render-blueprint";

export default defineBlueprint({
  previews: { generation: "automatic", expireAfterDays: 7 },
  databases: {
    main: { plan: "basic-1gb", region: "oregon", postgresMajorVersion: "18" },
  },
  services: {
    cache: { type: "keyvalue", ipAllowList: [] },
    api: {
      type: "web",
      runtime: "node",
      buildCommand: "pnpm build",
      startCommand: "pnpm start",
      healthCheckPath: "/healthz",
      envVars: {
        DATABASE_URL: fromDatabase("main", "connectionString"),
        REDIS_HOST: fromService("cache", "host"),
        STRIPE_KEY: secret(),          // -> sync: false
      },
    },
  },
});
// keys are the resource names; `fromDatabase("main", …)` is checked against `databases`
```

- Records-keyed-by-name make the name/key duplication disappear and give autocomplete on
  references for free (`keyof typeof databases`).
- Cost: references are still *string-ish*, and cross-file composition is awkward — you
  cannot export one service and assemble elsewhere without losing the key-based checking.

### (b) Construct/class-based, cdk8s-style, with `app.synth()`

```ts
import { Blueprint, WebService, Postgres, KeyValue } from "render-blueprint";

const app = new Blueprint({ outFile: "render.yaml", previews: { generation: "automatic" } });

const db = new Postgres(app, "main", { plan: "basic-1gb", region: "oregon" });
const cache = new KeyValue(app, "cache", { ipAllowList: [] });

const api = new WebService(app, "api", {
  runtime: "node",
  buildCommand: "pnpm build",
  startCommand: "pnpm start",
  healthCheckPath: "/healthz",
});
api.addEnv("DATABASE_URL", db.connectionString);
api.addEnv("REDIS_HOST", cache.host);
api.addSecret("STRIPE_KEY");

app.synth();   // writes render.yaml; throws a collected ValidationReport on error
```

- Buys mutation-after-construction (`addEnv`), a defaults scope on `app`, and a familiar
  `synth()` boundary. Subclassing gives real reuse (`class ApiService extends WebService`).
- Cost: `new X(app, "id", …)` is ceremony, registration is implicit, and every reviewer has
  to know that constructing has a side effect. Also invites the naming/hash mess if we ever
  add nesting.

### (c) Function-based builders with typed references

Railway's shape, adapted. My current favourite. **INFERRED.**

```ts
import { blueprint, web, worker, postgres, keyValue, envGroup, secret, generated }
  from "render-blueprint";

export default blueprint((ctx) => {
  const db = postgres("main", { plan: ctx.isPreview ? "free" : "basic-1gb" });
  const cache = keyValue("cache", { ipAllowList: [] });
  const settings = envGroup("conc-settings", { CONCURRENCY: "2", SECRET: generated() });

  const api = web("api", {
    runtime: "node",
    buildCommand: "pnpm build",
    startCommand: "pnpm start",
    healthCheckPath: "/healthz",
    env: {
      DATABASE_URL: db.connectionString,   // -> fromDatabase: {name: main, property: …}
      REDIS_HOST: cache.host,              // -> fromService: {type: keyvalue, name: cache, …}
      STRIPE_KEY: secret(),                // -> sync: false
      ...settings.all,                     // -> fromGroup: conc-settings
    },
  });

  const jobs = worker("jobs", { env: { API_URL: api.hostport } });

  return { name: "acme", resources: [db, cache, settings, api, jobs] };
});
```

- `db.connectionString` / `cache.host` / `api.hostport` are exactly Render's documented
  `fromDatabase.property` and `fromService.property` values, so the property access *is*
  the reference and a typo is a compile error.
- Resources are inert values: `const db = postgres(...)` can live in another file and be
  imported. Explicit `resources: [...]` keeps the output set visible.
- Cost: the duplication of `name` between the variable and the string argument, and a
  `resources` list you can forget to update — mitigated by a synth-time "declared but not
  returned" warning.

---

## Appendix: `render.yaml` facts this library must honour

From https://render.com/docs/blueprint-spec (verbatim field names):

- Root keys: `services`, `databases`, `envVarGroups`, `projects`, `ungrouped`,
  `previews.generation` (`off` | `manual` | `automatic`), `previews.expireAfterDays`.
- Postgres lives in `databases`, everything else (including `keyvalue`) in `services`.
- Service `type`: `web` | `pserv` | `worker` | `cron` | `keyvalue`. `runtime`: `node`,
  `python`, `elixir`, `go`, `ruby`, `rust`, `docker`, `image`, `static`.
- Immutable after creation: `type`, `runtime`, `region`, database `postgresMajorVersion`,
  `databaseName`, `user`, database `name`. **INFERRED: these are exactly the fields a
  synth-time validator should flag when they change against a committed baseline.**
- `envVars` is a *list of objects*, not a map, and each entry is one of five shapes:
  `{key, value}`, `{key, generateValue: true}`, `{key, sync: false}`,
  `{key, fromDatabase: {name, property}}`, `{key, fromService: {name, type, envVarKey | property}}`,
  or the group form `{fromGroup: name}`. A TS map → list conversion is one of the clearest
  wins available.
- Validation already exists and is free to reuse: JSON Schema at
  `https://render.com/schema/render.yaml.json` (also on SchemaStore.org), plus
  `render blueprints validate render.yaml`, which "exits with a non-zero status if the file
  fails validation", and a Validate Blueprint API endpoint. **INFERRED: the generator
  should shell out to / bundle this schema rather than reimplement validation.**
