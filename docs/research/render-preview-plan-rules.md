# Render Preview Plans and the Paid-Plan Rules

**Purpose:** record what Render documents about a preview instance on a free or small preview plan, for
the three rules that read only the base `plan`. The decision it serves is issue #100. This document
recommends. It does not decide.

**Fetch date:** 2026-09-12

**Doctrine:** the library is never stricter and never looser than Render without a citation. A reading
that the Render text does not state is marked INFERRED.

## 0. The question

Three rules read the base `plan` of a resource and never its preview plan:

| Rule | Kind | Condition | File |
| --- | --- | --- | --- |
| `PersistenceNeedsPaidPlan` (warning) | Key Value | `plan: 'free'` and a `persistenceMode` other than `off` | `src/validation/rules/persistence-needs-paid-plan.ts` |
| `MaintenanceModeNeedsPaidPlan` (warning) | web service | `plan: 'free'` and a `maintenanceMode` | `src/validation/rules/maintenance-mode-needs-paid-plan.ts` |
| `HighAvailabilityUnsupported` (issue) | Postgres | `highAvailability.enabled` on a plan under 1 CPU | `src/resources/postgres.ts` |

A resource with a paid base plan and a free preview plan gets no warning. In `render.yaml` the preview
plan is `previews.plan` on a web service, private service or worker, and `previewPlan` on Postgres and
Key Value. In the library, a web service takes `previews: { generation, plan, instances }`. A private
service and a worker take the same object with a paid plan only. A static site takes
`previews: { generation }` alone. A cron job and an environment group take no `previews`. Key Value
takes `previews: { plan }` and Postgres takes `previews: { plan, diskSizeGB }`; synthesis emits the plan
as `previewPlan`. So a free preview plan can occur on a web service, a Key Value store or a Postgres
database. The question: does Render document enough to warn on the preview plan too?

## Primary sources

| Ref | Source | Kind | Capture |
| --- | --- | --- | --- |
| `[SPEC]` | https://render.com/docs/blueprint-spec | Render doc | `docs/research/raw/render-blueprint-spec.md` (2026-09-05). The live `.md` is identical on 2026-09-12. |
| `[SCHEMA]` | https://render.com/schema/render.yaml.json | Render schema | `docs/research/raw/render.yaml.schema.json`. The live file is byte-identical on 2026-09-12. |
| `[PE]` | https://render.com/docs/preview-environments | Render doc | `docs/research/raw/render-preview-environments.md` (2026-09-09). The live `.md` and HTML match it on 2026-09-12. |
| `[SP]` | https://render.com/docs/service-previews | Render doc | `docs/research/raw/render-service-previews.md` (2026-09-12) |
| `[KV]` | https://render.com/docs/key-value | Render doc | `docs/research/raw/render-key-value.md` (2026-09-12) |
| `[MM]` | https://render.com/docs/maintenance-mode | Render doc | `docs/research/raw/render-maintenance-mode.md` (2026-09-12) |
| `[HA]` | https://render.com/docs/postgresql-high-availability | Render doc | `docs/research/raw/render-postgresql-high-availability.md` (2026-09-12) |
| `[API]` | https://api-docs.render.com/reference/preview-service | API reference | `docs/research/raw/render-api-preview-service.md` (2026-09-12) |
| `[BOARD]` | https://feedback.render.com/features/p/allow-pull-request-previews-to-be-on-free-tier | Staff reply on feedback.render.com, staff status INFERRED | URL only, fetched 2026-09-12 |
| `[PR38]` | https://github.com/render-examples/preview-environment/pull/38 | GitHub PR on a Render repo, by a Render docs writer (role from a third-party profile) | URL only, fetched 2026-09-12 |
| `[TF]` | https://github.com/render-oss/terraform-provider-render/pull/105 | Open, unmerged GitHub PR on a Render repo. Author not staff, INFERRED from the GitHub author association `NONE` | URL only, fetched 2026-09-12 |
| `[ART]` | https://render.com/articles/best-practices-for-implementing-git-based-deployment-in-production-environments | Render article, dated 2026-07-31 | URL only, fetched 2026-09-12 |
| `[TUT]` | https://render.com/tutorials/advanced-blueprint-patterns/preview-environments | Render tutorial, no date | URL only, fetched 2026-09-12 |
| `[PLANS]` | https://render.com/docs/compute-plans | Render doc | URL only, fetched 2026-09-12 |

A line citation such as `[KV]` L469 names the line in that capture. Trust order: Render docs, the API
reference and the schema first, then Render articles and tutorials, then the staff reply, then GitHub.

## 1. Two preview features

Render has two preview features. A sentence about one is not evidence about the other.

- **Preview environments** are a Blueprint feature. A pull request gets new instances of the resources
  in the Blueprint. `previews.plan` and `previewPlan` set their compute plan. The three rules concern
  this feature.
- **Service previews** are a feature of one service: pull request previews for a Git-backed service,
  image previews for an image-backed service. `[SP]` L24: "*Service previews only replicate the service
  with proposed changes.*"

## 2. What Render documents about a preview instance

| Statement | Verbatim quote | Source | Kind |
| --- | --- | --- | --- |
| A preview environment makes new instances | "A preview environment creates new instances of the services and datastores defined in your Blueprint. These instances do not copy any data from existing services. …" | `[PE]` L20 | Render doc |
| The preview plan sets the preview instance's compute | "Sets the preview instance's available compute resources." | `[SPEC]` L489 | Render doc |
| The same, per kind | "The compute plan to use for this service in preview environments." / "The compute plan to use for this Key Value instance in preview environments." / "The compute plan to use for this database in preview environments." | `[SCHEMA]` L636, L696, L183 | Render schema |
| An omitted preview plan is inherited | "If you don't specify a preview compute plan for a service, Render uses the same compute plan that you use in production." / "If you omit this field, preview instances use the same compute plan as the base service." | `[PE]` L98; `[SPEC]` L489 | Render doc. This is inheritance of the plan alone. It says nothing about other settings. |
| Render recommends small preview plans | "By using smaller compute plans for preview environments, you can reduce costs." | `[PE]` L91 | Render doc |
| Carve-out: autoscaling | "Autoscaling is disabled in [preview environments](preview-environments)." | `[SPEC]` L663 | Render doc |
| Carve-out: placeholder env vars | "Render does not include `sync: false` environment variables in [preview environments](preview-environments)." | `[SPEC]` L1352 | Render doc |
| Service previews copy settings | "Preview instances copy all of their settings over from their base service when they're first created." | `[SP]` L96 (pull request previews), L137 (image previews) | Render doc, service previews only |
| Preview environments take env vars from the Blueprint | "Because preview environments are generated from your Blueprint, their environment variables come from the `render.yaml` file itself, not from a copy of a running service's settings." | `[ART]` | Render article, env vars only |

Apart from the plan, no Render source says which settings a preview-environment instance takes from its
base resource.

## 3. The three settings

### 3.1 Key Value persistence on a free preview plan

Documented for a preview instance: **no**.

| Statement | Verbatim quote | Source | Kind |
| --- | --- | --- | --- |
| A free instance does not persist | "*Data persistence is not available for free Key Value instances.*" | `[KV]` L469 | Render doc |
| The same, in the spec | "Render uses `off` for a new free instance (data persistence is not available for free instances)." | `[SPEC]` L844 | Render doc |
| The preview plan can be free | `previewPlan` takes `keyValuePlan`, and that enum lists `free` | `[SCHEMA]` L694-696 (the reference), L503-521 (the enum, `free` at L507) | Render schema |

No source says that a preview Key Value instance takes `persistenceMode` from its base. No source says
what Render does with the mode on a free preview plan.

### 3.2 Maintenance mode on a free preview plan

Documented for a preview instance: **no**.

| Statement | Verbatim quote | Source | Kind |
| --- | --- | --- | --- |
| Paid web services only | "Maintenance mode is available only for paid web services." | `[MM]` L21 | Render doc |
| The same, in the spec | "Web services only. Requires a *[paid compute plan](/pricing#compute)*." | `[SPEC]` L585 | Render doc |
| The same, in the schema | "Configuration for service maintenance mode. Requires a paid web service instance." | `[SCHEMA]` L958 | Render schema |
| The API refuses it on a free base service, per the PR author | "every apply failing with `maintenance mode can only be configured for non-free tier services`" | `[TF]` | Open, unmerged GitHub PR; author not staff (INFERRED); REST API, a base service, no preview |

No source says that a preview web service instance takes `maintenanceMode` from its base. No source
says what Render does with it on a free preview plan. Section 4 records a rule one step earlier: in the
services API and for service previews, Render documents that a paid base plan cannot take a free
preview plan. None of those sources names preview environments, so the rule's scope to Blueprints is
INFERRED.

### 3.3 High availability on a preview plan under 1 CPU

Documented for a preview instance: **no**.

| Statement | Verbatim quote | Source | Kind |
| --- | --- | --- | --- |
| At least 1 CPU | "Use a [compute plan](compute-plans#render-postgres-plans) with at least 1 CPU" | `[HA]` L55 | Render doc |
| The same, in the spec | "Use a compute plan with at least 1 CPU" | `[SPEC]` L1047 | Render doc |
| The standby matches the primary | "Your standby instance always has the same compute plan and storage as your primary instance and is billed accordingly." | `[HA]` L49 | Render doc |
| Plans under 1 CPU | `free` and `0.1c-256mb` have 0.1 CPU, `0.5c-1g` has 0.5 CPU | `[SPEC]` L906-908 | Render doc |
| Render's own example uses a preview plan under 1 CPU | `plan: 1c-4g` with `previewPlan: 0.5c-1g`, and no `highAvailability` on the page | `[PE]` L117-118 | Render doc |

No source says that a preview database takes `highAvailability` from its base. No source says what
Render does with it on a preview plan under 1 CPU. `[PLANS]` lists `basic-1gb` as the legacy name of
`0.5c-1g`.

## 4. A separate candidate: a free preview plan under a paid base plan

This section records a possible item for a later spec. It is not a change to the three rules, and this
document does not decide it.

| Statement | Verbatim quote | Source | Kind |
| --- | --- | --- | --- |
| A paid base service cannot take a free preview | "Note that base services on any paid compute plan can't create preview instances with the `free` plan." | `[API]` L932, on the shared services `plan` enum | API reference |
| The same, for image previews | "If your base service uses a paid compute plan, its previews can't use the [Free compute plan](free)." | `[SP]` L149, under "Billing for image previews" (L145) | Render doc, image previews |
| The same, for pull request previews | "we do not allow paid services to override their preview plan to free as it is likely that these services would not be performant with the limited resources available on the free tier." | `[BOARD]`, Hari Demirev, 2021-12-06 | Staff reply on feedback.render.com, staff status INFERRED |
| The schema accepts a free Postgres preview plan | `previewPlan` takes `postgresPlan`, and that enum lists `free` | `[SCHEMA]` L181-183 (the reference), L522-577 (the enum, `free` at L526) | Render schema |
| A Render docs writer says a Postgres preview plan refuses `free` | "Updating the `previewPlan` attribute, because it doesn't accept `free`." | `[PR38]`, merged 2026-06-08 | GitHub PR on a Render repo. It gives no error text and no reason. Its blueprint's base plan is itself `free`: the diff sets `plan: free` with `previewPlan: basic-256mb`. INFERRED and unresolved, because it contradicts the schema row above. |

Scope:

- The `[API]` note sits on the `plan` enum of the services API. That enum is used by the preview-service
  request body and by the web service, private service, worker and cron job schemas. The Postgres and
  Key Value APIs have no preview field.
- That these four sources apply to Blueprint preview environments is INFERRED. None of them names
  preview environments.
- No source covers a Key Value `previewPlan`.

If the candidate holds for Blueprints, it comes before the maintenance-mode case. Render refuses or
replaces the free preview plan before a paid-only setting can matter. INFERRED.

## 5. Corrections to the first pass

A first pass on 2026-09-12 reported two points that this research corrects:

1. **The flexible-plan note.** The first pass reported a note on the live preview-environments page: a
   flexible-plan Postgres cannot take a non-flexible `previewPlan`, or the reverse. That note is not on
   the live page. The live `.md` and the live HTML, both fetched on 2026-09-12, have no "flexible". Only
   Exa's cached copy of the page has the note. That copy also says "instance type" and "Pro plan", where
   the live page says "compute plan" and "Pro workspace plan". INFERRED: the cached copy is older, and
   Render removed the note. `[TUT]` still states the plan-family rule. That rule is outside this
   question.
2. **The Free-plan sentence.** On the service-previews page, "If your base service uses a paid compute
   plan, its previews can't use the Free compute plan" sits under "Billing for image previews"
   (`[SP]` L145, L149). It is not a statement about pull request previews or preview environments. The
   live text says "compute plan", not "instance type".

The staff reply is on feedback.render.com, Render's feature-request board, not on the community forum.

## 6. Searched, nothing found

These sources have no sentence on persistence, maintenance mode or high availability for a preview
instance, for either preview feature:

- All Render docs, through `https://render.com/docs/llms-full.txt` (about 1 MB). The search took each
  line that holds "preview" together with a term for persistence, high availability, a standby,
  maintenance mode, a free or paid plan, inheritance, copying, flexible plans or a refusal. The hits
  include billing, the settings that service previews copy, the Free-plan sentence for image previews,
  and the data that preview environments do not copy. None ties a preview instance to persistence,
  maintenance mode or high availability.
- The whole Render OpenAPI spec, `https://api-docs.render.com/v1.0/openapi/render-public-api-1.json`.
  Its `errorCode` vocabulary has no code about previews. Its one plan code, `snapshot_plan_mismatch`,
  is about snapshots.
- The schema, `[SCHEMA]`.
- The Render changelog, the Render blog, and seven tutorial and article pages on render.com.
- The `render-oss/skills` repository, and GitHub issue search in the `render-oss`, `render-examples` and
  `renderinc` organisations.
- feedback.render.com.
- community.render.com, through a search engine index only. The forum's own search host did not resolve
  from the research environment. One unrelated thread came back.

## 7. Untested

What Render does at sync time is untested: whether a sync applies, ignores or refuses these settings on
a free or small preview plan. This research used no Render API key. It did not call the Validate
Blueprint API.

## 8. Verdict

**Quoted.** Render states each of these:

- A preview environment creates new instances of the Blueprint's services and datastores (`[PE]` L20).
- The preview plan sets the preview instance's compute (`[SPEC]` L489; `[SCHEMA]` L636, L696, L183).
- Data persistence is not available for free Key Value instances (`[KV]` L469; `[SPEC]` L844).
- Maintenance mode is available only for paid web services (`[MM]` L21; `[SPEC]` L585; `[SCHEMA]` L958).
- High availability needs a compute plan with at least 1 CPU (`[HA]` L55; `[SPEC]` L1047).
- Smaller preview plans reduce cost (`[PE]` L91).

**Inferred.**

- A preview instance on a free plan is a free instance, and one on a plan under 1 CPU is under 1 CPU.
  INFERRED from `[PE]` L20 and `[SPEC]` L489.
- A preview instance carries its base resource's `persistenceMode`, `maintenanceMode` or
  `highAvailability`. **No Render text states this for preview environments.** `[SP]` L96 and L137 say
  it for service previews only. This is the missing link.
- The free-preview rule of section 4 applies to Blueprint preview environments. INFERRED.

**Option A, warn on a free preview plan in all three rules: unsupported.** Each warning needs the
missing link above. No preview-only field exists for these settings. So the only fix for such a warning
is a paid preview plan or a change to production, while Render recommends smaller preview plans
(`[PE]` L91). Under `--strict` the warning fails CI on a combination that Render never calls wrong. An
issue on the preview plan for high availability would be stricter still.

**Option B, keep the preview plan out of scope until Render documents it: recommended for all three
rules.** Open the question again when Render documents that a preview instance carries one of these
settings, or when a sync test shows what Render does.

Section 4 is a separate question for a later spec. It does not change this verdict.
