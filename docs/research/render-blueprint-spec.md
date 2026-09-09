# Render Blueprint (`render.yaml`) — Field-by-Field Inventory

**Purpose:** a complete field/enum/constraint inventory of the Render Blueprint spec, written for someone
designing typed TypeScript builders that emit `render.yaml`. No design opinions here — inventory only.

**Fetch date:** 2026-09-05

**Primary sources**

| Ref | Source | Notes |
| --- | --- | --- |
| `[SPEC]` | https://render.com/docs/blueprint-spec | The prose reference. Verbatim capture at `docs/research/raw/render-blueprint-spec.md` (fetched via the `.md` endpoint `https://render.com/docs/blueprint-spec.md`, `text/markdown`). |
| `[SCHEMA]` | https://render.com/schema/render.yaml.json | **Found, HTTP 200, 38 KB.** Raw copy at `docs/research/raw/render.yaml.schema.json`. JSON Schema draft 2020-12. Also served from SchemaStore.org. |
| `[IAC]` | https://render.com/docs/infrastructure-as-code | Blueprint lifecycle/setup overview. |
| `[PREVIEW]` | https://render.com/docs/preview-environments | Preview environments. |
| `[SVCPREVIEW]` | https://render.com/docs/service-previews | Per-service PR previews. |
| `[KV]` | https://render.com/docs/key-value | Key Value maxmemory/persistence detail. |
| `[DISKS]` | https://render.com/docs/disks | Disk constraints. Verbatim capture at `docs/research/raw/render-disks.md` (fetched via the `.md` endpoint `https://render.com/docs/disks.md`, `text/markdown`). |
| `[SCALING]` | https://render.com/docs/scaling | Autoscaling constraints. |
| `[ENVVARS]` | https://render.com/docs/configure-environment-variables , https://render.com/docs/environment-variables | Env groups, Render-default env vars. |

**Convention used below:** where `[SPEC]` (prose) and `[SCHEMA]` (machine-readable) disagree, both are stated
and the disagreement is flagged. Anything not directly read in a source is marked **INFERRED**.

---

## 0. The single most important structural fact

`[SCHEMA]`

The JSON Schema does **not** model a service as one object with many optional fields. It models **four
mutually-exclusive service shapes**, combined with `anyOf`, each with `"additionalProperties": false`:

| Schema definition | Matches | `required` | Discriminator |
| --- | --- | --- | --- |
| `serverService` | web service, background worker, private service | `type`, `name`, `runtime` | `type` ∈ `web` \| `worker` \| `pserv` |
| `staticService` | static site | `type`, `name`, `runtime` | `type` **const** `web` **and** `runtime` **const** `static` |
| `cronService` | cron job | `type`, `name`, `runtime`, `schedule` | `type` **const** `cron` |
| `redisServer` | Key Value / Redis | `type`, `name`, `ipAllowList` | `type` ∈ `keyvalue` \| `redis` |

Because every shape sets `additionalProperties: false`, **field sets are genuinely disjoint**, not a shared
optional bag. Putting a `disk` on a cron job, or `staticPublishPath` on a worker, is a hard schema error.

Two consequences worth knowing up front:

1. **`type: web` is overloaded.** A static site is `type: web` + `runtime: static`. `type` alone is not a
   sufficient discriminator; you need `(type, runtime)`.
2. **A minimal static site matches two branches.** `{type: web, name: x, runtime: static}` validates against
   *both* `serverService` (whose `runtime` enum includes `static`) and `staticService`. Adding a
   static-only field (`staticPublishPath`) narrows it to `staticService`; adding a server-only field (`plan`)
   narrows it to `serverService`. **Adding both makes it match neither and fail validation** — e.g.
   `{type: web, runtime: static, plan: free, staticPublishPath: ./build}` is invalid per `[SCHEMA]`.
   (Consistent with `[SPEC]`, which never gives static sites a compute plan or a region.)

---

## 1. Top-level keys of `render.yaml`

`[SPEC]` "Root-level fields"; `[SCHEMA]` root `allOf` = `resources` + root-only object; root is
`unevaluatedProperties: false`.

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `services` | array of service objects | Optional | Non-Postgres services **and** Key Value instances. Root-level entries **keep their currently assigned environment** on each sync. |
| `databases` | array of database objects | Optional | Render Postgres **only**. Same environment-retention rule. |
| `envVarGroups` | array of env-group objects | Optional | Same environment-retention rule. |
| `projects` | array of project objects | Optional | Each project declares `environments`, each of which nests its own `services` / `databases` / `envVarGroups`. |
| `ungrouped` | object `{services?, databases?, envVarGroups?}` | Optional | Same shape as the root triple. Defining a resource here **removes it from any environment** it currently belongs to. |
| `previews` | object `{generation?, expireAfterDays?}` | Optional | Blueprint-level preview environments. |
| `previewsEnabled` | boolean | Optional, **DEPRECATED** | `true` ≡ `previews.generation: automatic`. |
| `previewsExpireAfterDays` | integer ≥ 1 | Optional, **DEPRECATED** | Superseded by `previews.expireAfterDays`. |
| `version` | string, **const `"1"`** | Optional | Present in `[SCHEMA]` only. **Not documented anywhere on `[SPEC]`.** The only legal value is the string `"1"`. |

**Hard rule stated three times in `[SPEC]`:** *"Do not define the same service / database / environment group
in more than one location."* A given resource appears in exactly one of: root-level, one
`projects[].environments[]`, or `ungrouped`.

### 1.1 `previews` (root)

`[SPEC]` root-level fields; `[PREVIEW]`; `[SCHEMA]` `rootPreviews` (`additionalProperties: false`)

| Field | Type | Notes |
| --- | --- | --- |
| `generation` | enum: `off` \| `manual` \| `automatic` | Omitting the whole `previews` block disables preview environments. |
| `expireAfterDays` | integer ≥ 1 | Days a preview env can go without new commits before auto-deprovision. Default: no expiry. Timer resets on every push. |

`generation` semantics `[PREVIEW]`:
- `manual` — only PRs whose **title** contains `[render preview]` get an environment.
- `automatic` — every PR against the linked branch gets one, unless the PR **title** contains
  `[skip preview]`, `[skip render]`, `[preview skip]`, or `[render skip]`.
- Root `previews` does **not** affect per-service `previews` (service previews) and vice versa. Two
  independent features.

---

## 2. Projects and environments

`[SPEC]` "Projects and environments"; `[SCHEMA]` `project`, `environment`

### `projects[]`
| Field | Type | Required |
| --- | --- | --- |
| `name` | string | **Required** |
| `environments` | array of environment objects | **Required** (schema); `[SPEC]` adds "each project must have at least one environment" (schema does **not** enforce `minItems: 1`) |

### `projects[].environments[]`
Schema: `allOf [resources, {name, networking, permissions}]`, `unevaluatedProperties: false`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | **Required** | |
| `services` | array | Optional | Same item schema as root `services`. |
| `databases` | array | Optional | Same item schema as root `databases`. |
| `envVarGroups` | array | Optional | Same item schema as root `envVarGroups`. |
| `networking.isolation` | enum: `enabled` \| `disabled` | Optional, default `disabled` | Blocks private-network traffic in/out of the environment. |
| `permissions.protection` | enum: `enabled` \| `disabled` | Optional, default `disabled` | Prevents destructive actions by non-admin workspace members. |

`networking` and `permissions` are objects with `additionalProperties: false` and exactly one property each.

---

## 3. Services — `type` and `runtime`, and which combinations are valid

### 3.1 `type` values

`[SPEC]` `type`; `[SCHEMA]`

| Value | Meaning | Required for | Immutable? |
| --- | --- | --- | --- |
| `web` | web service **or** static site | Static site also needs `runtime: static` | **You can't modify `type` after creation** `[SPEC]` |
| `pserv` | private service | | same |
| `worker` | background worker | | same |
| `cron` | cron job | also requires `schedule` | same |
| `keyvalue` | Render Key Value instance | also requires `ipAllowList` | same |
| `redis` | **DEPRECATED alias** for `keyvalue` | | same |

Postgres is **not** a service `type` — it lives in the separate root `databases` list.

### 3.2 `runtime` values

`[SPEC]` `runtime`; `[SCHEMA]` `runtime` enum (9 values, alphabetical in the schema)

*Native language runtimes:* `node`, `python`, `elixir`, `go`, `ruby`, `rust`
*Special-case runtimes:* `docker` (build from a `Dockerfile`), `image` (pull a prebuilt image), `static` (static sites)

- `runtime` is **required** unless `type` is `keyvalue` or `redis` `[SPEC]`. Consistent with `[SCHEMA]`:
  `redisServer` has no `runtime` property at all; `serverService`, `cronService`, `staticService` all list
  `runtime` in `required`.
- **`env` is the deprecated predecessor of `runtime`** `[SPEC]`. Note that `env` does **not** appear anywhere
  in `[SCHEMA]` — a blueprint still using `env:` will pass Render's own sync but **fail IDE/JSON-Schema
  validation**.
- A service's runtime **can** be changed after creation, **except for static sites** `[SPEC]`.

### 3.3 Valid `(type, runtime)` combinations

| `type` | Allowed `runtime` | Source |
| --- | --- | --- |
| `web` (web service) | `node`, `python`, `elixir`, `go`, `ruby`, `rust`, `docker`, `image` | `[SCHEMA]` `serverService.runtime` = full enum; `static` also validates but see §0.2 |
| `web` (static site) | `static` **only** | `[SCHEMA]` `staticService.runtime` const `static` |
| `pserv` | `node`, `python`, `elixir`, `go`, `ruby`, `rust`, `docker`, `image` | `[SCHEMA]`; `static` nominally in the enum but meaningless — **INFERRED** that Render rejects `pserv` + `static` |
| `worker` | same as `pserv` | `[SCHEMA]` |
| `cron` | full enum incl. `image` | `[SCHEMA]` `cronService.runtime` → shared `runtime` enum |
| `keyvalue` / `redis` | *(field absent — must not be set)* | `[SCHEMA]` `redisServer` has no `runtime`, `additionalProperties: false` |

**Caveat:** `[SCHEMA]` reuses one flat `runtime` enum for `serverService` and `cronService`, so it permits
nonsense pairs like `type: worker, runtime: static`. `[SPEC]` prose constrains `static` to static sites.
A typed builder can legitimately be stricter than the schema here.

---

## 4. Service fields

Legend for the *Shapes* column: **S** = `serverService` (web/worker/pserv), **T** = `staticService`,
**C** = `cronService`, **K** = `redisServer` (keyvalue). A field is only legal on the listed shapes.

### 4.1 Common / essential

| Field | Type | Shapes | Required | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| `name` | string | S T C K | **Required** | — | Must be unique per resource in the Blueprint. Naming an **existing** service adopts it into the Blueprint. |
| `type` | enum (§3.1) | S T C K | **Required** | — | Immutable after creation. |
| `runtime` | enum (§3.2) | S T C | **Required** | — | Absent on K. |
| `plan` | `serverPlan` (S) / `cronPlan` (C) / `keyValuePlan` (K) | S C K — **not T** | Optional | `0.5c-512mb` for new S/C; `256mb` for new K; existing resources retain current plan | See §8.1. |
| `region` | `region` enum | S C K — **not T** | Optional | `oregon` | **Immutable after creation.** "Does not apply to static sites." |
| `repo` | string (Git URL) | S T C | Optional | repo containing the Blueprint file | Your Git provider account must have access. |
| `branch` | string | S T C | Optional | repo's default branch | `[SPEC]` warns: setting this **breaks preview environments** — previews then always use this fixed branch instead of the PR branch. |
| `rootDir` | string | S T C | Optional | repo root | Changes outside it don't trigger builds. |
| `buildCommand` | string | S T C | **Required for non-Docker services** `[SPEC]`; optional in `[SCHEMA]` | — | |
| `startCommand` | string | S C — **not T** | **Required for non-Docker services** `[SPEC]`; optional in `[SCHEMA]` | — | Docker services use `dockerCommand` instead. |
| `preDeployCommand` | string | S T C | Optional | — | Runs after build, before start. For static sites: after build, before deploy. |
| `initialDeployHook` | string | S only | Optional | — | Runs once after the **first** successful deploy (incl. once per preview env). Deprecated alias: **`afterFirstDeployCommand`** (not in `[SCHEMA]`). |
| `schedule` | string (cron expression) | C only | **Required** | — | |
| `autoDeployTrigger` | enum `commit` \| `checksPass` \| `off` | S T C | Optional | `commit` for new services; existing retain current | Replaces deprecated `autoDeploy`. Takes precedence if both present. **No effect for prebuilt-image services.** |
| `autoDeploy` | boolean | S T C | Optional, **DEPRECATED** | — | `true` ≡ `commit`, `false` ≡ `off`. |
| `envVars` | array of env-var objects | S T C — **not K** | Optional | — | See §6. |
| `buildFilter` | `{paths?: string[], ignoredPaths?: string[]}` | S T C | Optional | — | Glob syntax, relative to repo root. **Destructive on sync:** omitting it *replaces* an existing service's filters with empty lists. |
| `domains` | string[] | S T (prose: web + static only) | Optional | — | Render auto-adds the `www.`↔root counterpart with a redirect. |
| `domain` | string (singular) | S T | Optional | — | **In `[SCHEMA]` only; undocumented on `[SPEC]`.** Legacy single-domain form. |
| `renderSubdomainPolicy` | enum `enabled` \| `disabled` | S T (prose: web + static only) | Optional | `enabled` for new; existing retain current | `disabled` requires ≥1 custom domain. |
| `healthCheckPath` | string starting with `/` | S only (prose: **web services only**) | Optional | — | Enables zero-downtime deploys. |
| `maxShutdownDelaySeconds` | integer 1–300 | S only | Optional | `30` | SIGTERM grace period before SIGKILL. |
| `maintenanceMode` | `{enabled?: bool, uri?: uri}` | S only (prose: **web services only, paid plans**) | Optional | `enabled: false` | `uri` must be absolute and must **not** point at the same service. Omit `uri` for Render's default page. |
| `ipAllowList` | array of `{source, description?}` | S T K + databases | Optional for S/T/db, **Required for K** | allow-all for new S/T/db | See §7. Web/static require a **Scale or Enterprise** workspace plan. |
| `disk` | `{name, mountPath, sizeGB?}` | S only | Optional | `sizeGB: 10` | See §4.4. |
| `numInstances` | integer ≥ 1 | S only | Optional | `1` for new; existing retain current | Ignored when `scaling` is set. |
| `scaling` | `{minInstances, maxInstances, targetMemoryPercent?, targetCPUPercent?}` | S only | Optional | — | See §4.5. |
| `previews` | `servicePreviews` (S) / `staticServicePreviews` (T) | S T — **not C, not K** | Optional | previews disabled | See §4.6. |
| `pullRequestPreviewsEnabled` | boolean | S T | Optional, **DEPRECATED** | — | `true` ≡ `previews.generation: automatic`. |
| `previewPlan` | `serverPlan` (S) / `keyValuePlan` (K) | S (**DEPRECATED**), K (**current**) | Optional | same as `plan` | On S it is deprecated in favour of `previews.plan`; on **K it is the only form** (K has no `previews` object). |
| `registryCredential` | `{fromRegistryCreds: {name}}` | S C — **not T, not K** | Optional | no credential | For private base images in a `Dockerfile`. |

### 4.2 Docker — building from a `Dockerfile` (`runtime: docker`)

`[SPEC]` "Docker"; `[SCHEMA]` `serverService` / `cronService`

| Field | Type | Shapes | Default |
| --- | --- | --- | --- |
| `dockerCommand` | string | S C | the `Dockerfile`'s `CMD` |
| `dockerfilePath` | string, relative to repo root | S C | `./Dockerfile` |
| `dockerContext` | string, relative to repo root | S C | repo root |
| `registryCredential` | `{fromRegistryCreds: {name: string}}` | S C | none |

`fromRegistryCreds.name` refers to a credential added in the Render Dashboard (Workspace Settings) or via the
Render API — **it is not defined in `render.yaml`.** Both `registryCredential` and `image.creds` use the
identical `{fromRegistryCreds: {name}}` shape (`additionalProperties: false`, `name` required).

### 4.3 Docker — pulling a prebuilt image (`runtime: image`)

| Field | Type | Shapes | Required |
| --- | --- | --- | --- |
| `image.url` | string, e.g. `docker.io/my-name/my-image:latest` | S C — **not T, not K** | **Required** if `image` present |
| `image.creds` | `{fromRegistryCreds: {name}}` | S C | Optional; only for private images |

- `image` and `repo` are the two alternative sources: *"For services that pull a prebuilt Docker image, set
  `image` instead of [`repo`]"* `[SPEC]`. **`[SCHEMA]` does not enforce this exclusivity** — both may be set
  and it still validates.
- **There is no `image.sha` field** in either `[SPEC]` or `[SCHEMA]`. The image digest/tag is expressed inside
  `image.url`.
- `autoDeployTrigger` has no effect for prebuilt-image services `[SPEC]`.

### 4.4 Disks (`disk`) — `serverService` only

`[SPEC]` "Disks"; `[DISKS]`; `[SCHEMA]` `disk` (`additionalProperties: false`)

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `name` | string | **Required** | — |
| `mountPath` | string | **Required** | — |
| `sizeGB` | integer ≥ 1 | Optional | `10` |

Constraints:
- `name` and `mountPath` are mutable. `sizeGB` may be **increased but never decreased**.
- `name` can be any string, including `disk`; it is not currently shown in the Dashboard.
- **Disallowed exact mount paths** `[DISKS]`: `/`, `/opt`, `/opt/render`, `/opt/render/project`,
  `/opt/render/project/src`, `/home`, `/home/render`, `/etc`, `/etc/secrets`. Subdirectories of these
  *are* allowed (e.g. `/opt/render/project/src/uploads`).
- **A service with a disk cannot be scaled to multiple instances** `[SPEC]`, `[DISKS]`, `[SCALING]` — so
  `disk` is mutually exclusive with meaningful `numInstances > 1` and with `scaling`.
- Adding a disk **disables zero-downtime deploys**.
- **Cron jobs cannot have a disk** — enforced structurally by `[SCHEMA]` (no `disk` on `cronService`).
- Disks are inaccessible during `buildCommand`, `preDeployCommand`, and one-off jobs.

### 4.5 Scaling — `serverService` only

`[SPEC]` "Scaling"; `[SCALING]`; `[SCHEMA]` `serverService.scaling`

| Field | Type | Required (schema) | Required (prose) | Range |
| --- | --- | --- | --- | --- |
| `minInstances` | integer | not in `required` | "Required" | ≥ 1 |
| `maxInstances` | integer | not in `required` | "Required" | ≥ 1 |
| `targetMemoryPercent` | integer | no | Optional if `targetCPUPercent` set | 1–90 |
| `targetCPUPercent` | integer | no | Optional if `targetMemoryPercent` set | 1–90 |

**Note the schema gap:** the `scaling` object has **no `required` array at all** in `[SCHEMA]`, so
`scaling: {}` validates, and neither the "min ≤ max" relation nor "at least one target must be set" is
enforced. `[SPEC]` states both `minInstances` and `maxInstances` are required and that at least one target
metric must be present.

Constraints `[SPEC]`, `[SCALING]`:
- Autoscaling requires a **Pro workspace or higher**; manual scaling is available on all workspaces.
- Cannot scale a service with an attached persistent disk.
- Adding an existing service to a Blueprint **retains** its autoscaling settings unless `scaling` is present.
- If both `numInstances` and `scaling` are set, **autoscaling wins and `numInstances` is ignored.**
- Autoscaling is **disabled in preview environments**; autoscaled services run exactly `minInstances` there.

### 4.6 Per-service previews (`previews`)

`[SPEC]`; `[SVCPREVIEW]`; `[PREVIEW]`; `[SCHEMA]` `servicePreviews` / `staticServicePreviews`

| Field | Type | S (`servicePreviews`) | T (`staticServicePreviews`) |
| --- | --- | --- | --- |
| `generation` | enum `automatic` \| `manual` \| `off` | yes | yes |
| `plan` | `serverPlan` | yes | **no** |
| `numInstances` | integer ≥ 1 | yes | **no** |

- Both objects are `additionalProperties: false` with **no required fields**.
- `[SPEC]` documents `generation` for services as only `manual` \| `automatic`; `[SCHEMA]` reuses the
  three-value `previewsGeneration` enum that also includes `off`. **Discrepancy.**
- Omitting `previews` disables PR previews for that service.
- `previews.numInstances` "ignores autoscaling configuration" `[SCHEMA]`; if omitted, previews use the base
  service's instance count, or `minInstances` when autoscaled.
- `cronService` and `redisServer` have **no `previews` object**. Key Value uses the flat `previewPlan`;
  databases use flat `previewPlan` + `previewDiskSizeGB`.
- Per-service previews (`service.previews`) and Blueprint preview environments (root `previews`) are
  independent features that do not affect each other `[SPEC]`.

### 4.7 Static-site-specific fields (`staticService`)

`[SPEC]` "Static sites"; `[SCHEMA]` `staticService`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `staticPublishPath` | string, relative to repo root | **Required** per `[SPEC]`; **not** in `[SCHEMA]`'s `required` | e.g. `./build`, `./dist` |
| `headers` | array of `{path, name, value}` — all three **required** | Optional | `path` is a glob (`/*`, `/blog/*`). **Additive on sync:** Render *preserves* existing header rules not present in the Blueprint. |
| `routes` | array of `{type, source, destination}` — all three **required** | Optional | `type` ∈ `redirect` \| `rewrite`. Redirect = HTTP 301. **Additive on sync**, same as `headers`. |
| `previews` | `{generation?}` only | Optional | |
| `pullRequestPreviewsEnabled` | boolean, **DEPRECATED** | Optional | |

Static sites **do not have**: `plan`, `region`, `startCommand`, `disk`, `numInstances`, `scaling`,
`healthCheckPath`, `maxShutdownDelaySeconds`, `maintenanceMode`, `initialDeployHook`, `image`,
`dockerfilePath`/`dockerContext`/`dockerCommand`, `registryCredential`, `previewPlan`. All structurally
excluded by `additionalProperties: false` in `[SCHEMA]`.

The `header` and `route` item schemas do **not** set `additionalProperties: false` — extra keys inside a
header/route entry pass validation.

### 4.8 Field availability matrix (from `[SCHEMA]`, authoritative)

| Field | web/worker/pserv | static | cron | keyvalue |
| --- | :-: | :-: | :-: | :-: |
| `type`, `name` | ✅ | ✅ | ✅ | ✅ |
| `runtime` | ✅ | ✅ (const `static`) | ✅ | ❌ |
| `region` | ✅ | ❌ | ✅ | ✅ |
| `plan` | ✅ `serverPlan` | ❌ | ✅ `cronPlan` | ✅ `keyValuePlan` |
| `repo`, `branch`, `rootDir` | ✅ | ✅ | ✅ | ❌ |
| `buildCommand` | ✅ | ✅ | ✅ | ❌ |
| `startCommand` | ✅ | ❌ | ✅ | ❌ |
| `preDeployCommand` | ✅ | ✅ | ✅ | ❌ |
| `initialDeployHook` | ✅ | ❌ | ❌ | ❌ |
| `schedule` | ❌ | ❌ | ✅ (required) | ❌ |
| `dockerCommand` / `dockerfilePath` / `dockerContext` | ✅ | ❌ | ✅ | ❌ |
| `image` | ✅ | ❌ | ✅ | ❌ |
| `registryCredential` | ✅ | ❌ | ✅ | ❌ |
| `envVars` | ✅ | ✅ | ✅ | ❌ |
| `buildFilter` | ✅ | ✅ | ✅ | ❌ |
| `autoDeploy` / `autoDeployTrigger` | ✅ | ✅ | ✅ | ❌ |
| `domain` / `domains` | ✅ | ✅ | ❌ | ❌ |
| `renderSubdomainPolicy` | ✅ | ✅ | ❌ | ❌ |
| `healthCheckPath` | ✅ | ❌ | ❌ | ❌ |
| `numInstances` / `scaling` | ✅ | ❌ | ❌ | ❌ |
| `disk` | ✅ | ❌ | ❌ | ❌ |
| `maxShutdownDelaySeconds` | ✅ | ❌ | ❌ | ❌ |
| `maintenanceMode` | ✅ | ❌ | ❌ | ❌ |
| `ipAllowList` | ✅ | ✅ | ❌ | ✅ (required) |
| `previews` | ✅ (3 fields) | ✅ (1 field) | ❌ | ❌ |
| `previewPlan` | ✅ (deprecated) | ❌ | ❌ | ✅ (current) |
| `pullRequestPreviewsEnabled` | ✅ (deprecated) | ✅ (deprecated) | ❌ | ❌ |
| `maxmemoryPolicy` / `persistenceMode` | ❌ | ❌ | ❌ | ✅ |
| `staticPublishPath` / `headers` / `routes` | ❌ | ✅ | ❌ | ❌ |

⚠️ `[SCHEMA]` is **looser than `[SPEC]` prose** for several `serverService` fields: `healthCheckPath`,
`maintenanceMode`, `domains`, `domain`, `renderSubdomainPolicy`, and `ipAllowList` are structurally
available to `worker` and `pserv`, but `[SPEC]` restricts them to **web services (and static sites)**.

---

## 5. Render Key Value (`type: keyvalue` / deprecated `type: redis`)

`[SPEC]` "Render Key Value"; `[KV]`; `[SCHEMA]` `redisServer` (`additionalProperties: false`)

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `type` | enum `keyvalue` \| `redis` | **Required** | — |
| `name` | string | **Required** | — |
| `ipAllowList` | array of `{source, description?}` | **Required** (the only resource where it is) | — |
| `region` | `region` enum | Optional | `oregon` |
| `plan` | `keyValuePlan` enum | Optional | `256mb` |
| `previewPlan` | `keyValuePlan` enum | Optional | same as `plan` |
| `maxmemoryPolicy` | enum, see below | Optional | `allkeys-lru` |
| `persistenceMode` | enum `journal-snapshot` \| `snapshot` \| `off` | Optional | `journal-snapshot` for new **paid**; `off` for new **free** (persistence unavailable on free); existing paid retain current |

`maxmemoryPolicy` — **`[SPEC]` and `[SCHEMA]` disagree.**

| Value | In `[SPEC]` blueprint-spec page | In `[SCHEMA]` | In `[KV]` docs table |
| --- | :-: | :-: | :-: |
| `allkeys-lru` (default) | ✅ | ✅ | ✅ |
| `volatile-lru` | ✅ | ✅ | ✅ |
| `allkeys-random` | ✅ | ✅ | ✅ |
| `volatile-random` | ✅ | ✅ | ✅ |
| `volatile-ttl` | ✅ | ✅ | ✅ |
| `noeviction` | ✅ | ✅ | ✅ |
| **`allkeys-lfu`** | ❌ **omitted** | ✅ | ✅ |
| **`volatile-lfu`** | ❌ **omitted** | ✅ | ✅ |

The 8-value list (`[SCHEMA]` + `[KV]`) is the correct one; the blueprint-spec page's 6-value list is stale.

Key Value instances have **no `envVars`, no `runtime`, no `disk`, no `previews` object, no `buildCommand`**.
Changing `persistenceMode` triggers a restart; changing to or from `off` **loses all data** `[KV]`.

---

## 6. Environment variables

`[SPEC]` "Setting environment variables"; `[SCHEMA]` `envVar` = `anyOf` of four shapes.

### 6.1 Every shape

`[SCHEMA]`: all four variants are `additionalProperties: false`, so they cannot be mixed with each other.

**(a) `envVarFromKeyValue`** — required: `key`. All other properties optional.

| Property | Type | Meaning |
| --- | --- | --- |
| `key` | string | **Required.** Variable name. |
| `value` | string \| **number** | Literal value. Numbers are explicitly allowed by `[SCHEMA]`. |
| `generateValue` | boolean | `true` → Render generates a random base64-encoded 256-bit value (e.g. `B0jrphAPOY7pg92AN0c9MN4yecczLMdwnx4OkA1KFUk=`) **only if the variable doesn't already exist**. |
| `sync` | boolean | `false` → prompt for the value in the Dashboard (secrets). |
| `previewValue` | string \| **number** | Override used in preview environments. |

⚠️ **`[SCHEMA]` does not enforce mutual exclusivity.** `{key: X}` alone validates; so does
`{key: X, value: a, generateValue: true, sync: false, previewValue: b}`. Any exclusivity is a real-world /
prose constraint only. Four sub-forms are *intended* per `[SPEC]`: `key+value`, `key+generateValue: true`,
`key+sync: false`, and `key+value+previewValue`.

**(b) `envVarFromDatabase`** — required: `key`, `fromDatabase`.
```yaml
- key: DATABASE_URL
  fromDatabase:
    name: mydatabase        # required
    property: connectionString  # required
```

**(c) `envVarFromService`** — required: `key`, `fromService`.
```yaml
- key: MINIO_PASSWORD
  fromService:
    name: minio             # required
    type: pserv             # required
    envVarKey: MINIO_ROOT_PASSWORD   # XOR with `property`
```
`fromService` requires `name` **and** `type`. `property` and `envVarKey` are **both optional in `[SCHEMA]`**,
though `[SPEC]` says *"All fields shown in each example are required"* — i.e. exactly one of
`property` / `envVarKey` is expected. **The schema does not enforce this XOR, and does not forbid setting both.**

**(d) `envVarFromGroup`** — required: `fromGroup`, and **nothing else is allowed**.
```yaml
- fromGroup: my-env-group
```
`{key: X, fromGroup: Y}` is **invalid** (`additionalProperties: false`). This variant imports *all* variables
from the group.

### 6.2 `property` enums by source

**`fromDatabase.property` — `databaseEnvVarProperty`** (7 values, `[SCHEMA]`):
`connectionString`, `connectionPoolString`, `host`, `port`, `user`, `password`, `database`

`[SPEC]`'s "Supported properties" prose describes:
- `connectionString` — *Render Postgres and Key Value.* Postgres form `postgresql://user:password@host:port/database`; Key Value form `redis://red-xxxxxxxxxxxxxxxxxxxx:6379` (or `redis://user:password@red-…:6379` with internal auth enabled).
- `connectionPoolString` — *Render Postgres only.* Managed pgbouncer pool URL; format `postgresql://user:password@host:port/database`.
- `user` — *Render Postgres only.* Component of `connectionString`.
- `password` — *Render Postgres only.* Component of `connectionString`.
- `database` — *Render Postgres only.* The DB name inside the instance (not the instance `name`).
- `host`, `port` — described by `[SPEC]` under web/private services, but **`[SCHEMA]` also permits them on
  `fromDatabase`**. **INFERRED:** they yield the Postgres instance's private-network host/port.

**`fromService.property` — `serviceEnvVarProperty`** (4 values, `[SCHEMA]`):
`host`, `port`, `hostport`, `connectionString`

- `host` — *web + private services only.* Private-network hostname.
- `port` — *web + private services only.* Port of the service's HTTP server.
- `hostport` — *web + private services only.* `host:port`, e.g. `my-service:10000`. Use this for private-network connections.
- `connectionString` — *Render Postgres and Key Value only.* So `fromService` + `type: keyvalue` + `property: connectionString` is the way to get a Key Value URL.

**`fromService.type` — `serviceType`** (9 values, `[SCHEMA]`) — **this is a wider enum than the top-level
service `type`**:
`web`, `cron`, `worker`, `pserv`, `static`, `dpg`, `job`, `redis`, `keyvalue`

`static`, `dpg` (**INFERRED**: Render's internal prefix for Postgres, from ID prefixes like `dpg-…`) and
`job` are **not** valid values for a service's own `type` field — they only appear here, for referencing.
They are undocumented on `[SPEC]`.

### 6.3 `sync: false` semantics and limitations

`[SPEC]` "Prompting for secret values":
- You are prompted for the value **only during initial Blueprint creation**. On subsequent syncs of an
  existing Blueprint, `sync: false` variables are **ignored** — new secrets must be added manually.
- `sync: false` variables are **not copied into preview environments**. Workaround `[PREVIEW]`: define them in
  a manually-created environment group and reference it with `fromGroup` (and that group must not be managed
  by the same Blueprint, or a fresh group is created per preview env and the placeholders still aren't copied).
- **`sync: false` cannot be used inside an `envVarGroup`** — Render ignores such a variable. (Note: `[SCHEMA]`
  *does* structurally allow `sync` inside a group, since group items use `envVarFromKeyValue`.)

### 6.4 Sync/merge semantics for env vars

`[SPEC]`: *"A Blueprint can create new environment variables or modify the values of existing ones. Render
**preserves** existing environment variables, even if you omit them from the Blueprint file."* — env vars are
**merge-additive**, unlike `buildFilter` which is replace-destructive.

### 6.5 Variable interpolation

**Not supported.** `[SPEC]`: *"Render does not support variable interpolation in Blueprint files."*
The documented workaround is a build/start script that interpolates at runtime.

### 6.6 Self-reference

A service may reference **itself** via `fromService` with its own `name`, typically to alias a
Render-provided default env var:
```yaml
- key: APP_HOST
  fromService:
    name: my-app
    type: web
    envVarKey: RENDER_EXTERNAL_HOSTNAME
```
Render-provided defaults available as `envVarKey` targets include (`[ENVVARS]`): `IS_PULL_REQUEST`, `RENDER`,
`RENDER_CPU_COUNT`, `RENDER_DISCOVERY_SERVICE`, `RENDER_EXTERNAL_HOSTNAME`, `RENDER_EXTERNAL_URL`,
`RENDER_GIT_BRANCH`, `RENDER_GIT_COMMIT`, `RENDER_GIT_REPO_SLUG`, `RENDER_INSTANCE_ID`, `RENDER_SERVICE_ID`,
`RENDER_SERVICE_NAME`, `RENDER_SERVICE_TYPE`, `RENDER_WEB_CONCURRENCY`, `WEB_CONCURRENCY`, `PORT`.

---

## 7. `ipAllowList` (inbound IP rules)

`[SPEC]` "Inbound IP rules"; `[SCHEMA]` `ipAllowList`

Entry shape (the item schema does **not** set `additionalProperties: false`):

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `source` | string, IP or CIDR (e.g. `203.0.113.4/30`, `198.51.100.1`) | **Required** | |
| `description` | string | Optional | Free-text label, e.g. `office`, `home`, `VPN`. |

| Resource | Workspace plan required | `ipAllowList` required? |
| --- | --- | --- |
| Render Postgres | any | Optional — defaults to allow-all |
| Render Key Value | any | **Required** |
| Web services and static sites | **Scale or Enterprise** | Optional — defaults to allow-all |
| Background workers, private services, cron jobs | — | Not applicable per `[SPEC]` (though `[SCHEMA]` allows it on worker/pserv) |

- `ipAllowList: []` (empty list) = **block all external connections**, private-network only.
- `ipAllowList: [{source: 0.0.0.0/0, description: everywhere}]` = allow everything.
- Omitting the field: allow-all for a **new** resource; **retain current** for an existing one.

---

## 8. Enum reference (complete)

### 8.1 Compute plans, by resource kind

Plan values fall into two families: **legacy tier names** (`starter`, `standard`, `pro`, …), which appear
**only in `[SCHEMA]`**, and **current CPU/RAM identifiers** (`1c-2g`, …), which appear in both. The `[SPEC]`
tables list only the current identifiers.

**`serverPlan`** — web services, private services, background workers, and `previews.plan` / deprecated
service `previewPlan`. `[SCHEMA]` (21 values):

`free`, `starter`, `standard`, `pro`, `pro plus`, `pro max`, `pro ultra` *(legacy names)*,
`0.5c-512mb`, `1c-2g`, `2c-4g`, `2c-8g`, `2c-16g`, `4c-8g`, `4c-16g`, `4c-32g`, `8c-16g`, `8c-32g`,
`8c-64g`, `12c-24g`, `12c-48g`, `12c-96g`

`[SPEC]` CPU/RAM mapping — **web services** (`free` = 0.1 CPU / 512 MB; then 0.5c-512mb, 1c-2g, 2c-4g, 2c-8g,
2c-16g, 4c-8g, 4c-16g, 4c-32g, 8c-16g, 8c-32g, 8c-64g, 12c-24g, 12c-48g, 12c-96g).
**Private services / background workers** — the identical list **minus `free`** per the `[SPEC]` table
(`[SCHEMA]` does not distinguish; both share `serverPlan`, which includes `free`).

**`cronPlan`** — cron jobs. `[SCHEMA]` (15 values), **note: no `free`**:

`starter`, `standard`, `pro`, `pro plus` *(legacy)*, `0.5c-512mb`, `1c-2g`, `2c-4g`, `2c-8g`, `2c-16g`,
`4c-8g`, `4c-16g`, `4c-32g`, `8c-16g`, `8c-32g`, `8c-64g`

(Matches the `[SPEC]` cron table, which also tops out at `8c-64g` and omits `free` and the `12c-*` tier.)

**`keyValuePlan`** — Key Value. `[SCHEMA]` (13 values):

`free`, `starter`, `standard`, `pro`, `pro plus`, `pro max`, `pro ultra` *(legacy)*,
`256mb`, `1g`, `5g`, `10g`, `20g`, `40g`

`[SPEC]` RAM / connection-limit mapping: `free` 25 MB / 50 conns; `256mb` / 250; `1g` / 1,000; `5g` / 5,000;
`10g` / 10,000; `20g` / 20,000; `40g` / 40,000.

**`postgresPlan`** — databases and their `previewPlan`. `[SCHEMA]` (47 values):

*Legacy tier names:* `free`, `starter`, `standard`, `pro`, `pro plus`
*Legacy sized names:* `basic-256mb`, `basic-1gb`, `basic-4gb`, `pro-4gb`, `pro-8gb`, `pro-16gb`, `pro-32gb`,
`pro-64gb`, `pro-128gb`, `pro-192gb`, `pro-256gb`, `pro-384gb`, `pro-512gb`, `accelerated-16gb`,
`accelerated-32gb`, `accelerated-64gb`, `accelerated-128gb`, `accelerated-256gb`, `accelerated-384gb`,
`accelerated-512gb`, `accelerated-768gb`, `accelerated-1024gb`
*Current identifiers:* `0.1c-256mb`, `0.5c-1g`, `1c-2g`, `1c-4g`, `2c-4g`, `2c-8g`, `2c-16g`, `4c-16g`,
`4c-32g`, `8c-32g`, `8c-64g`, `16c-64g`, `16c-128g`, `32c-128g`, `32c-256g`, `48c-192g`, `48c-384g`,
`64c-256g`, `64c-512g`, `96c-384g`, `96c-768g`, `128c-512g`, `128c-1024g`

`[SPEC]` maps `free` and `0.1c-256mb` both to 0.1 CPU / 256 MB.

**Static sites have no plan field at all.**

### 8.2 All other enums

| Enum | Values | Where used |
| --- | --- | --- |
| `region` | `oregon` (default), `ohio`, `virginia`, `frankfurt`, `singapore` | service `region`, database `region`, keyvalue `region`. **Immutable after creation.** |
| `runtime` | `docker`, `elixir`, `go`, `image`, `node`, `python`, `ruby`, `rust`, `static` | service `runtime` |
| service `type` | `web`, `pserv`, `worker`, `cron`, `keyvalue`, `redis` (deprecated) | service `type` |
| `serviceType` (env-var refs only) | `web`, `cron`, `worker`, `pserv`, `static`, `dpg`, `job`, `redis`, `keyvalue` | `fromService.type` |
| `autoDeployTrigger` | `off`, `commit`, `checksPass` | service `autoDeployTrigger` |
| `previewsGeneration` | `automatic`, `manual`, `off` | root `previews.generation`, `previews.generation` on S and T |
| `renderSubdomainPolicy` | `enabled`, `disabled` | S, T |
| `maxmemoryPolicy` | `allkeys-lru` (default), `volatile-lru`, `allkeys-lfu`, `volatile-lfu`, `allkeys-random`, `volatile-random`, `volatile-ttl`, `noeviction` | keyvalue |
| `persistenceMode` | `journal-snapshot`, `snapshot`, `off` | keyvalue |
| `connectionPool` | `pgbouncer`, `none` | database |
| `postgresMajorVersion` | strings `"10"`, `"11"`, `"12"`, `"13"`, `"14"`, `"15"`, `"16"`, `"17"`, `"18"` | database. **Must be a string, not a number.** Default = latest supported (currently 18). |
| `databaseEnvVarProperty` | `connectionString`, `connectionPoolString`, `host`, `port`, `user`, `password`, `database` | `fromDatabase.property` |
| `serviceEnvVarProperty` | `host`, `port`, `hostport`, `connectionString` | `fromService.property` |
| route `type` | `redirect`, `rewrite` | static site `routes[].type` |
| `networking.isolation` | `enabled`, `disabled` (default `disabled`) | environment |
| `permissions.protection` | `enabled`, `disabled` (default `disabled`) | environment |
| `version` | const `"1"` | root |

### 8.3 Numeric ranges and other value constraints

| Field | Constraint | Source |
| --- | --- | --- |
| `maxShutdownDelaySeconds` | integer, 1 ≤ n ≤ 300, default 30 | `[SPEC]`, `[SCHEMA]` |
| `scaling.targetCPUPercent` | integer, 1 ≤ n ≤ 90 | `[SPEC]`, `[SCHEMA]` |
| `scaling.targetMemoryPercent` | integer, 1 ≤ n ≤ 90 | `[SPEC]`, `[SCHEMA]` |
| `scaling.minInstances` / `maxInstances` | integer ≥ 1 | `[SCHEMA]` |
| `numInstances` | integer ≥ 1, default 1 | `[SCHEMA]` |
| `disk.sizeGB` | integer ≥ 1, default 10; increase-only | `[SPEC]`, `[SCHEMA]` |
| `diskSizeGB` / `previewDiskSizeGB` (db) | integer ≥ 1 **and must be `1` or a multiple of 5**; increase-only. `[SCHEMA]` only encodes `minimum: 1` — the multiple-of-5 rule is prose-only | `[SPEC]`, `[SCHEMA]` |
| `previews.expireAfterDays` | integer ≥ 1 | `[SCHEMA]` |
| `healthCheckPath` | "always starts with a `/` character" — **not encoded as a pattern in `[SCHEMA]`** | `[SPEC]` |
| `maintenanceMode.uri` | `"format": "uri"`; must be absolute; must not point at the same service | `[SPEC]`, `[SCHEMA]` |
| `readReplicas` | at most **5** per Postgres instance — **not encoded in `[SCHEMA]`** (no `maxItems`) | `[SPEC]` |
| env var `value` / `previewValue` | `string` **or** `number` | `[SCHEMA]` |
| `postgresMajorVersion` | string, not integer | `[SCHEMA]` |
| **Resource names** | "Provide a unique name for each resource in your Blueprint file." **No character set, length, or format constraint is documented or encoded anywhere.** `[SPEC]` examples include names with spaces (`private database`, `highly available database`, `private cache`). | `[SPEC]`, `[SCHEMA]` |

---

## 9. Databases (Render Postgres)

`[SPEC]` "Database fields"; `[SCHEMA]` `database` (`additionalProperties: false`, `required: ["name"]`)

| Field | Type | Required | Default / on-omit behaviour | Mutable? |
| --- | --- | --- | --- | --- |
| `name` | string | **Required** | — | **Immutable after creation** |
| `plan` | `postgresPlan` enum | Optional | `0.1c-256mb` for new; existing retain current | Yes (but moving off a legacy instance type is one-way) |
| `previewPlan` | `postgresPlan` enum | Optional | same as `plan` | — |
| `databaseName` | string | Optional | auto-generated from `name` | **Immutable after creation** |
| `user` | string | Optional | auto-generated from `name` | **Immutable after creation** |
| `region` | `region` enum | Optional | `oregon` | **Immutable after creation** |
| `postgresMajorVersion` | string enum `"10"`–`"18"` | Optional | latest supported (currently `"18"`) | **Immutable after creation** |
| `diskSizeGB` | integer, `1` or a multiple of `5` | Optional | Free 1 GB / Basic 15 GB / Pro 100 GB / Accelerated 250 GB by plan tier; existing retain current | **Increase only** |
| `previewDiskSizeGB` | same | Optional | same as `diskSizeGB` | — |
| `storageAutoscalingEnabled` | boolean | Optional | `false` for new; existing retain current | Yes |
| `connectionPool` | enum `pgbouncer` \| `none` | Optional | `none` for new; existing retain current | Yes |
| `ipAllowList` | array of `{source, description?}` | Optional | allow-all for new; existing retain current | Yes |
| `readReplicas` | array of `{name}` | Optional | omitting **preserves** existing replicas | See below |
| `highAvailability` | `{enabled}` — `enabled` **required**, `additionalProperties: false` | Optional | — | Yes |

Notes and constraints:
- **`diskSizeGB` and `storageAutoscalingEnabled` are invalid for legacy instance types**, which have a fixed
  disk size `[SPEC]`.
- `readReplicas` sync semantics are **name-diff based and destructive**: omit → preserve; provide new names →
  create new replicas *and destroy any existing replica not matching a listed name*; `readReplicas: []` →
  destroy all replicas, create none. Max **5**.
- A read replica's properties are referenceable from another service's env vars *"as you would for any other
  database"* — i.e. `fromDatabase: {name: <replica name>, property: …}`.
- `highAvailability` requires: a **Pro workspace or higher**, a compute plan with **≥ 1 CPU**, and
  **PostgreSQL 13 or later**.
- Databases have **no `previews` object**, **no `envVars`**, **no `type` field** (they're identified by
  living in the `databases` list).

---

## 10. `envVarGroups`

`[SPEC]` "Environment groups"; `[SCHEMA]` `envVarGroup`

| Field | Type | Required |
| --- | --- | --- |
| `name` | string | **Required** |
| `envVars` | array of **`envVarFromKeyValue` only** | **Required in `[SCHEMA]`**; `[SPEC]` says "a list of **zero or more** `envVars`" — discrepancy on whether the key may be omitted (an empty array satisfies both) |

Constraints `[SPEC]`:
- An environment group **cannot reference values** from services or from other environment groups — i.e. no
  `fromService`, no `fromDatabase`, no `fromGroup` inside a group. Enforced structurally by `[SCHEMA]`.
- **`sync: false` cannot be used** in a group; Render ignores such a variable. (Not enforced by `[SCHEMA]`,
  which allows the `sync` property because group items reuse `envVarFromKeyValue`.)
- `previewValue` **is** supported for environment groups `[PREVIEW]` and is structurally allowed by `[SCHEMA]`.
- `generateValue: true` is used in `[SPEC]`'s own group examples, so it is supported.
- Environment groups can also contain **secret files** `[ENVVARS]`, but **secret files are not expressible in
  `render.yaml`** — Dashboard/API only.
- The `envVarGroup` definition in `[SCHEMA]` is missing `"type": "object"` (schema quirk; `additionalProperties:
  false` still applies).

---

## 11. Previews: how the two features interact with services and databases

`[SPEC]`, `[PREVIEW]`, `[SVCPREVIEW]`

There are **two distinct, independent** preview mechanisms:

| | **Preview environments** | **Service previews (PR previews)** |
| --- | --- | --- |
| Configured at | root `previews.generation` | per-service `previews.generation` |
| Scope | **All** resources in the Blueprint, cloned as a new environment | **One** service, cloned standalone |
| Applies to | web, pserv, worker, cron, keyvalue, Postgres | web services and static sites |
| Compute-plan override | services: `previews.plan`; keyvalue: `previewPlan`; Postgres: `previewPlan` + `previewDiskSizeGB` | `previews.plan` |
| Instance-count override | `previews.numInstances` | `previews.numInstances` |
| Env var override | `previewValue`, supported for web services, private services and environment groups only, per `docs/research/raw/render-preview-environments.md` § "Environment variables" | (inherits base service settings verbatim) |
| Expiry | root `previews.expireAfterDays` | tied to PR lifetime |

Per-resource preview behaviour:
- **New instances, no data copied.** Preview databases/datastores start empty; use `initialDeployHook` to seed.
- **`initialDeployHook` runs once per preview environment**, on that environment's first successful deploy.
- **Autoscaling is disabled in preview environments** — autoscaled services run exactly `minInstances`.
- **`sync: false` variables are not copied** into preview environments (§6.3).
- **Setting `branch` on a service breaks preview environments** — previews then always build that fixed branch
  instead of the PR branch.
- **`rootDir` / `buildFilter` gate preview creation**: a preview environment is created only if the PR's
  changed files match at least one service's root directory or build filter paths.
- Service preview instances **copy all settings, including env vars and database connection info**, from the
  base service — `[SVCPREVIEW]` explicitly warns to change those if you want a staging DB.
- Preview resources are billed the same as normal services, prorated by the second.

---

## 12. Cross-resource reference semantics (what a typed IaC must model)

`[SPEC]` "Referencing service properties"; `[IAC]`

**Every cross-resource link in `render.yaml` is a plain-string name reference.** There are no IDs, no
anchors, no YAML aliases required, and no interpolation syntax. The referencing fields are:

| Referencing field | Points at | Resolution requirement |
| --- | --- | --- |
| `envVars[].fromService.name` (+ `.type`) | Any non-Postgres **service** | The service **must exist in your Render workspace**. It **need not be defined in this Blueprint**. If it exists in neither, *"your Blueprint fails to sync."* Self-reference (the service's own `name`) is explicitly supported. |
| `envVars[].fromService.envVarKey` | An env var **on that service** | Includes Render-provided defaults like `RENDER_EXTERNAL_HOSTNAME`. **INFERRED:** no validation that the key exists at authoring time. |
| `envVars[].fromDatabase.name` | A Render **Postgres instance or read replica** | Same workspace-existence rule. Read replicas are addressable by their own `name`. |
| `envVars[].fromGroup` | An **environment group** | Same workspace-existence rule — commonly used to reference a Dashboard-managed group not in the Blueprint (the documented workaround for preview secrets). |
| `registryCredential.fromRegistryCreds.name` / `image.creds.fromRegistryCreds.name` | A **workspace registry credential** | **Never definable in `render.yaml`.** Must pre-exist via Dashboard (Workspace Settings) or the Render API. Always an out-of-Blueprint reference. |
| `disk.name` | nothing — a **local label** | Not a reference; can be any string, not surfaced in the Dashboard. |
| `readReplicas[].name` | nothing — **declares** a replica | Becomes a referenceable target for `fromDatabase.name`. |
| `domains[]` / `domain` | external DNS | Requires DNS configuration outside Render. |
| `maintenanceMode.uri` | external URL | Must not point at the same service. |
| Service/database/group `name` at root vs. in `projects[].environments[]` vs. `ungrouped` | the **same** resource | Location determines environment membership. **A resource must appear in exactly one location.** |

Additional semantics a generator must respect:
- **Names are the identity.** Reusing an existing resource's `name` in a Blueprint **adopts** that resource and
  applies the Blueprint's config to it `[SPEC]`, `[IAC]`. `[IAC]` warns you must then include *all* currently-set
  options, since omitted fields fall back to defaults that "almost definitely differ".
- **A resource must be managed by at most one Blueprint** `[IAC]`; two Blueprints managing one resource gives
  last-sync-wins, unpredictable behaviour.
- **Sync never deletes.** Removing a resource from the Blueprint (or disconnecting the Blueprint entirely) does
  **not** delete it. Deleting it in the Dashboard while it's still in the Blueprint **recreates it** on the next
  sync. Correct order: remove from Blueprint first, then delete in the Dashboard.
- **`fromService` / `fromDatabase` values refresh only on Blueprint sync**, not when the referenced property
  changes `[SPEC]`.
- **Merge vs. replace on sync** differs by field — this is important for a generator that emits a "full" file:
  - env vars: **preserved/merged** (omitted vars survive)
  - static site `headers` and `routes`: **preserved/merged** (omitted rules survive)
  - `readReplicas`: **name-diffed and destructive** (unlisted replicas are destroyed) — unless the key is omitted entirely
  - `buildFilter`: **replaced** (omitting the key wipes existing filters to empty lists)
  - most scalar fields: omitting **retains the current value** on an existing resource, but applies a
    **default** on a new one.

---

## 13. Deprecated / superseded fields (complete list)

| Deprecated | Replacement | In `[SCHEMA]`? |
| --- | --- | --- |
| `env` (service) | `runtime` | **No** — using `env:` fails JSON-Schema validation |
| `autoDeploy: true/false` | `autoDeployTrigger: commit/off` | Yes (marked implicitly; `autoDeployTrigger` takes precedence when both present) |
| root `previewsEnabled: true` | root `previews.generation: automatic` | Yes, `"deprecated": true` |
| root `previewsExpireAfterDays` | root `previews.expireAfterDays` | Yes, `"deprecated": true` |
| service `pullRequestPreviewsEnabled: true` | service `previews.generation: automatic` | Yes, `"deprecated": true` (on S and T) |
| service `previewPlan` | service `previews.plan` | Yes, `"deprecated": true` — **but `previewPlan` is the *current, non-deprecated* form for Key Value and Postgres** |
| `type: redis` | `type: keyvalue` | Yes, both accepted |
| `afterFirstDeployCommand` | `initialDeployHook` | **No** |
| `domain` (singular) | `domains` (array) | Yes, undocumented on `[SPEC]` |
| legacy plan names (`starter`, `standard`, `pro`, `pro plus`, `pro max`, `pro ultra`, `basic-*`, `pro-*gb`, `accelerated-*gb`) | CPU/RAM identifiers (`1c-2g`, …) | Yes; **absent from `[SPEC]`'s plan tables**. Moving a database off a legacy instance type is **one-way**. |

---

## 14. Validation tooling

`[SPEC]` "Validating Blueprints"

1. **IDE:** the schema is published to SchemaStore.org, so VS Code / Cursor with the Red Hat YAML extension
   validate `render.yaml` automatically. Direct URL: `https://render.com/schema/render.yaml.json`.
2. **CLI:** `render blueprints validate render.yaml` — requires Render CLI **v2.7.0+**; exits non-zero on
   failure. It does **semantic** checks beyond the schema, e.g. the documented sample error
   `services[0].branch (line 19, column 5): branch prod could not be found`.
3. **API:** the [Validate Blueprint endpoint](https://api-docs.render.com/reference/validate-blueprint).
   Returns HTTP `200` either way; check the `valid` boolean in the response body.

---

## 15. Complete example Blueprints (verbatim from the docs)

### 15.1 Minimal: Django web service + Render Postgres

Source: https://render.com/docs/infrastructure-as-code

```yaml
# This is a basic example Blueprint for a Django web service and
# the Render Postgres database it connects to.
services:
  - type: web # A Python web service named django-app running on a free instance
    plan: free
    name: django-app
    runtime: python
    repo: https://github.com/render-examples/django.git
    buildCommand: './build.sh'
    startCommand: 'python -m gunicorn mysite.asgi:application -k uvicorn.workers.UvicornWorker'
    envVars:
      - key: DATABASE_URL # Sets DATABASE_URL to the connection string of the django-app-db database
        fromDatabase:
          name: django-app-db
          property: connectionString

databases:
  - name: django-app-db # A Render Postgres database named django-app-db running on a free instance
    plan: free
```

### 15.2 The full reference example (`render.yaml` exercising most supported fields)

Source: https://render.com/docs/blueprint-spec (section "Example Blueprint file"). Reproduced verbatim.

```yaml
#################################################################
# Example render.yaml                                           #
# Do not use this file directly! Consult it for reference only. #
#################################################################

previews:
  generation: automatic # Enable preview environments

# List services *except* Render Postgres databases here
services:
  # A web service on the Ruby native runtime
  - type: web
    runtime: ruby
    name: sinatra-app
    repo: https://github.com/render-examples/sinatra # Default: Repo containing render.yaml
    numInstances: 3 # Manual scaling configuration. Default: 1 for new services
    region: frankfurt # Default: oregon
    plan: 1c-2g # Default: 0.5c-512mb
    branch: prod # Default: master
    buildCommand: bundle install
    preDeployCommand: bundle exec ruby migrate.rb
    startCommand: bundle exec ruby main.rb
    autoDeployTrigger: 'off' # Disable automatic deploys
    maxShutdownDelaySeconds: 120 # Increase graceful shutdown period. Default: 30, Max: 300
    initialDeployHook: ./seed_database.sh # Runs after the first successful deploy of a service
    domains: # Custom domains
      - example.com
      - www.example.org
    renderSubdomainPolicy: disabled # Disable access via the service's onrender.com subdomain. Default: enabled
    envVars: # Environment variables
      - key: API_BASE_URL
        value: https://api.example.com # Hardcoded value
      - key: APP_SECRET
        generateValue: true # Generate a base64-encoded 256-bit value
      - key: ANTHROPIC_API_KEY
        sync: false # Prompt for a value in the Render Dashboard
      - key: DATABASE_URL
        fromDatabase: # Reference a property of a database (see available properties below)
          name: mydatabase
          property: connectionString
      - key: MINIO_PASSWORD
        fromService: # Reference a value from another service
          name: minio
          type: pserv
          envVarKey: MINIO_ROOT_PASSWORD
      - fromGroup: my-env-group # Add all variables from an environment group
    ipAllowList: # Optional (defaults to allow all); Scale and Enterprise workspaces only
      - source: 203.0.113.4/30
        description: office
      - source: 198.51.100.1
        description: home

  # A web service that builds from a Dockerfile
  - type: web
    runtime: docker
    name: webdis
    repo: https://github.com/render-examples/webdis.git # Default: Repo containing render.yaml
    rootDir: webdis # Default: Repo root
    dockerCommand: ./webdis.sh # Default: Dockerfile CMD
    scaling: # Autoscaling configuration
      minInstances: 1
      maxInstances: 3
      targetMemoryPercent: 60 # Optional if targetCPUPercent is set
      targetCPUPercent: 60 # Optional if targetMemory is set
    maintenanceMode: # Maintenance mode configuration (paid web services only)
      enabled: true
      uri: https://example.com/maintenance # Optional custom maintenance page URL
    healthCheckPath: /
    registryCredential: # Default: No credential
      fromRegistryCreds:
        name: my-credentials
    envVars:
      - key: REDIS_HOST
        fromService: # Reference a property from another service (see available properties below)
          type: keyvalue
          name: lightning
          property: host
      - key: REDIS_PORT
        fromService:
          type: keyvalue
          name: lightning
          property: port
      - fromGroup: conc-settings

  # A private service with an attached persistent disk
  - type: pserv
    runtime: docker
    name: minio
    repo: https://github.com/render-examples/minio.git # Default: Repo containing render.yaml
    envVars:
      - key: MINIO_ROOT_PASSWORD
        generateValue: true # Generate a base64-encoded 256-bit value
      - key: MINIO_ROOT_USER
        sync: false # Prompt for a value in the Render Dashboard
      - key: PORT
        value: 10000
    disk: # Persistent disk configuration
      name: data
      mountPath: /data
      sizeGB: 10 # optional

  # A Python cron job that runs every hour
  - type: cron
    name: date
    runtime: python
    schedule: '0 * * * *'
    buildCommand: 'true' # ensure it's a string
    startCommand: date
    repo: https://github.com/render-examples/docker.git # optional

  # A Dockerfile-based background worker
  - type: worker
    name: queue
    runtime: docker
    dockerfilePath: ./sub/Dockerfile # Optional
    dockerContext: ./sub/src # Optional
    branch: queue # Optional

  # A static site
  - type: web
    name: my-blog
    runtime: static
    buildCommand: yarn build
    staticPublishPath: ./build
    previews:
      generation: automatic # Enable service previews
    buildFilter:
      paths:
        - src/**/*.js
      ignoredPaths:
        - src/**/*.test.js
    headers:
      - path: /*
        name: X-Frame-Options
        value: sameorigin
    routes:
      - type: redirect
        source: /old
        destination: /new
      - type: rewrite
        source: /a/*
        destination: /a
    ipAllowList: # Optional (defaults to allow all); Scale and Enterprise workspaces only
      - source: 203.0.113.4/30
        description: office
      - source: 198.51.100.1
        description: home

  # A Key Value instance
  - type: keyvalue
    name: lightning
    ipAllowList: # Required
      - source: 0.0.0.0/0
        description: everywhere
    plan: free # Default: 256mb
    maxmemoryPolicy: noeviction # Default: allkeys-lru
    persistenceMode: off # Default: journal-snapshot

# List Render Postgres databases here
databases:
  # A database with one read replica
  - name: elephant
    databaseName: mydb # Optional (Render may add a suffix)
    user: adrian # Optional
    ipAllowList: # Optional (defaults to allow all)
      - source: 203.0.113.4/30
        description: office
      - source: 198.51.100.1
        description: home
    readReplicas:
      - name: elephant-replica

  # A database that allows only private network connections
  - name: private database
    databaseName: private
    ipAllowList: [] # No entries in the IP allow list

  # A database with specified disk size and storage autoscaling
  - name: pachyderm
    plan: 0.5c-1g
    diskSizeGB: 35
    storageAutoscalingEnabled: true

  # A database that enables high availability
  - name: highly available database
    plan: 2c-8g
    highAvailability:
      enabled: true

# Environment groups
envVarGroups:
  - name: conc-settings
    envVars:
      - key: CONCURRENCY
        value: 2
      - key: SECRET
        generateValue: true
  - name: stripe
    envVars:
      - key: STRIPE_API_URL
        value: https://api.stripe.com/v2
```

### 15.3 Projects and environments

Source: https://render.com/docs/blueprint-spec (section "Projects and environments"). Reproduced verbatim.

```yaml
projects:
  - name: my-project
    environments:
      - name: production
        # These resources will belong to the my-project/production environment.
        # Do not duplicate these definitions at the root level.
        services:
          - name: my-web-service
            type: web
            runtime: node
            buildCommand: npm install
            startCommand: npm start
            envVars:
              - key: MY_ENV_VAR
                value: my-value
        databases:
          - name: my-database
            plan: 0.1c-256mb
        envVarGroups:
          - name: my-env-group
            envVars:
              - key: MY_ENV_VAR
                value: my-value
        # Environment-specific settings
        networking:
          isolation: enabled
        permissions:
          protection: enabled
```

---

## 16. Open questions / ambiguities

Things the docs and the JSON Schema leave genuinely unclear. Each is a decision a typed builder will be
forced to make one way or the other.

**A. Resource name format is completely unspecified.** Neither `[SPEC]` nor `[SCHEMA]` gives a character
set, length limit, or pattern for `name` on services, databases, env groups, projects, environments, or read
replicas. `[SPEC]`'s own examples use names with **spaces** (`private database`, `highly available database`,
`private cache`), yet Render derives `onrender.com` subdomains and private-network hostnames from service
names. The transformation from `name` to hostname is undocumented. Uniqueness scope is also vague: `[SPEC]`
says "unique for each resource in your Blueprint file" — whether that means unique per resource *kind* or
globally across services + databases + groups is not stated.

**B. `[SCHEMA]` does not encode most of the prose constraints.** A file can be schema-valid and still fail to
sync. Known gaps: no `required` on `scaling` (so `scaling: {}` validates, and min ≤ max is unchecked); no XOR
between `fromService.property` and `fromService.envVarKey` (and neither is required); no exclusivity among
`value` / `generateValue` / `sync` on an env var; `diskSizeGB`'s "1 or a multiple of 5" rule is prose-only;
`readReplicas` has no `maxItems: 5`; `healthCheckPath`'s leading-`/` rule has no `pattern`; `image` and `repo`
are not mutually exclusive; `staticPublishPath` is not in `staticService.required` despite `[SPEC]` calling it
*Required*; `buildCommand`/`startCommand` are never `required` despite `[SPEC]` calling them required for
non-Docker services. Which authority a builder should follow is a real choice.

**C. `[SPEC]` and `[SCHEMA]` disagree on several enums.** `maxmemoryPolicy`: the blueprint-spec page lists 6
values, the schema and the Key Value docs list 8 (the page omits `allkeys-lfu` and `volatile-lfu`). Service
`previews.generation`: `[SPEC]` says `manual` | `automatic`, the schema also permits `off`. Compute plans:
the schema carries ~20 legacy tier names (`starter`, `pro plus`, `basic-4gb`, `accelerated-256gb`, …) that
appear in **no** `[SPEC]` table. Cron plans in the schema lack `free` and the `12c-*` tier; whether that is
accurate or stale is not stated.

**D. Undocumented schema-only fields.** `version` (const `"1"`) and `domain` (singular) exist in `[SCHEMA]`
but appear nowhere on `[SPEC]`. Whether `version` is required for anything, what it does, and whether it is
forward-looking are all unknown. Likewise `serviceType` includes `dpg`, `job`, and `static` for env-var
references — `dpg` is **INFERRED** to mean Postgres (matching Render's `dpg-…` resource ID prefix) and `job`
is **INFERRED** to mean one-off jobs, but neither is documented, and it is unclear whether `fromService` with
`type: dpg` is a supported alternative to `fromDatabase`.

**E. The static-site schema branch is ambiguous by construction.** `{type: web, name, runtime: static}`
matches both `serverService` and `staticService` (see §0.2), and combining a server-only field with a
static-only field matches neither and fails validation. Whether Render's own sync engine applies the same
discrimination as the published schema, or uses `runtime` as a hard discriminator, is not documented.

**F. Fields the schema allows on worker/pserv that the prose restricts to web services.** `healthCheckPath`,
`maintenanceMode`, `domains`, `domain`, `renderSubdomainPolicy`, and `ipAllowList` all sit on the shared
`serverService` definition. `[SPEC]` says web-only (or web + static). Whether Render silently ignores them on
a worker or rejects the sync is unstated.

**G. `runtime: static` on `pserv` / `worker` / `cron`.** Structurally permitted by the shared `runtime` enum;
semantically meaningless. Not addressed anywhere. **INFERRED** to be rejected at sync time.

**H. `envVarGroups[].envVars` — required or not?** `[SCHEMA]` puts `envVars` in `required`; `[SPEC]` says a
group has "a list of **zero or more** `envVars`". An empty array satisfies both, but whether the key may be
omitted entirely is contradictory.

**I. Cron jobs and previews.** `cronService` has no `previews` object and no `previewPlan` in `[SCHEMA]`.
`[PREVIEW]` says preview environments create "the services and datastores defined in your Blueprint" without
naming cron jobs explicitly. Whether cron jobs are cloned into preview environments — and on what plan — is
not stated.

**J. Key Value has no `envVars`, but `connectionString` may include credentials.** `[SPEC]` notes the Key
Value `connectionString` becomes `redis://user:password@…` "if internal authentication is enabled", but
internal auth is **not configurable from `render.yaml`** — no field exists on `redisServer`. So a referenced
`connectionString` can change shape based on state a Blueprint cannot express.

**K. Secret files are not expressible in `render.yaml`.** `[ENVVARS]` documents secret files as first-class
members of environment groups, but no field exists for them in `[SPEC]` or `[SCHEMA]`. Dashboard/API only.

**L. Ordering and dependency resolution are unspecified.** Nothing states whether the order of entries in
`services` / `databases` affects provisioning order, or how Render topologically resolves `fromService` /
`fromDatabase` chains — including whether a reference cycle between two services is rejected or tolerated.

**M. `[SPEC]` never lists a `previews` field for `redisServer` or `database`, only flat `previewPlan`.** The
inconsistency (services use nested `previews.plan`, datastores use flat `previewPlan`) is documented as fact
but not explained, and it is unclear whether the nested form will eventually be extended to datastores —
relevant because service `previewPlan` is already deprecated while datastore `previewPlan` is current.

**N. What "Blueprint sync" validates vs. what it silently defaults.** `[IAC]` warns that when adopting an
existing resource you must restate *all* current settings or "your Blueprint will use a default value that
almost definitely differs". But §12's merge-vs-replace table shows the behaviour is per-field and only
partially documented (env vars merge, `buildFilter` replaces, `readReplicas` name-diffs, scalars retain).
There is no exhaustive published list of which fields retain-on-omit versus default-on-omit.
