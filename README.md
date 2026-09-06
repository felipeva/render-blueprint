# render-blueprint

`render-blueprint` describes Render.com resources with typed TypeScript factories and synthesizes
them to `render.yaml`. It is a generator only: it never calls the Render API, and the file it
writes is the state.

## Install

```sh
pnpm add -D render-blueprint
```

The package holds the library and the `render-blueprint` binary. The binary needs Node 22.18.0 or
newer, because it loads your blueprint file through Node's native type stripping.

## The scenario

Each app declares its own resources in its own file. The root file assembles them. The two files
below are the scenario the test suite freezes at `test/fixtures/canonical/`.

An app exports a function of its dependencies. Every handle it receives keeps its type across the
file boundary. `deps.db.connectionString` is a compile-checked reference, and `deps.cache.host`
does not compile.

```ts
// apps/api/api-service.ts
import {
  literal,
  secret,
  type EnvironmentGroup,
  type KeyValueStore,
  type PostgresDatabase,
  type PrivateService,
  type ReadReplica,
  type ResourceFactories,
  type WebService,
} from 'render-blueprint';

export interface ApiDependencies {
  readonly factories: ResourceFactories;
  readonly db: PostgresDatabase;
  readonly replica: ReadReplica;
  readonly cache: KeyValueStore;
  readonly auth: PrivateService;
  readonly settings: EnvironmentGroup;
}

export const apiService = (deps: ApiDependencies): WebService =>
  deps.factories.web('api', {
    runtime: 'node',
    rootDir: 'apps/api',
    buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
    startCommand: 'pnpm start',
    healthCheckPath: '/healthz',
    scaling: { minInstances: 2, maxInstances: 6, targetCPUPercent: 70 },
    domains: ['acme.dev'],
    previews: { generation: 'automatic', plan: 'starter' },
    envGroups: [deps.settings],
    env: (self) => ({
      NODE_ENV: 'production',
      LOG_FORMAT: literal('json', { previewValue: 'pretty' }),
      DATABASE_URL: deps.db.connectionString,
      REPLICA_URL: deps.replica.connectionString,
      CACHE_URL: deps.cache.connectionString,
      AUTH_HOST: deps.auth.host,
      STRIPE_KEY: secret(),
      APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME'),
    }),
  });
```

The root file creates the shared resources, calls each app function, and exports the blueprint as
the default export. `withDefaults` sets the region, the repository and one plan per kind in one
place. A value on a resource always wins over a default.

```ts
// render.ts
import {
  blueprint,
  external,
  generated,
  literal,
  readReplica,
  withDefaults,
  type Blueprint,
  type ResourceFactories,
} from 'render-blueprint';
import { apiService } from './apps/api/api-service.ts';

const acme: ResourceFactories = withDefaults({
  region: 'oregon',
  repo: 'https://github.com/acme/mono',
  plan: {
    web: 'standard',
    privateService: '1c-2g',
    worker: '1c-2g',
    cron: 'starter',
    keyValue: 'standard',
    postgres: 'basic-1gb',
  },
});

const replica = readReplica('records-replica');

const db = acme.postgres('records', {
  databaseName: 'records',
  user: 'records_user',
  postgresMajorVersion: '17',
  diskSizeGB: 20,
  highAvailability: { enabled: true },
  ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
  previews: { plan: 'basic-256mb', diskSizeGB: 5 },
  readReplicas: [replica],
});

const cache = acme.keyValue('cache', {
  ipAllowList: [],
  maxmemoryPolicy: 'allkeys-lru',
  persistenceMode: 'journal-snapshot',
});

const settings = acme.envGroup('shared-settings', {
  env: {
    LOG_LEVEL: 'info',
    FEATURE_FLAGS: literal('billing', { previewValue: 'billing,debug' }),
    SESSION_SECRET: generated(),
  },
});

const auth = acme.privateService('auth', {
  runtime: 'image',
  image: { url: 'docker.io/acme/auth:1.4.2', creds: external.registryCredential('acme-dockerhub') },
  dockerCommand: './auth serve',
  instances: 1,
  disk: { name: 'keys', mountPath: '/var/keys', sizeGB: 5 },
  previews: { generation: 'manual', plan: '1c-2g', instances: 1 },
  env: { AUTH_LOG_LEVEL: 'info' },
});

const api = apiService({ factories: acme, db, replica, cache, auth, settings });

const jobs = acme.worker('jobs', {
  runtime: 'docker',
  dockerfilePath: './apps/jobs/Dockerfile',
  dockerContext: './',
  dockerCommand: 'node jobs.js',
  buildFilter: { paths: ['apps/jobs/**'], ignoredPaths: ['**/*.md'] },
  env: {
    QUEUE_URL: cache.connectionString,
    API_HOSTPORT: api.hostport,
    API_LOG_FORMAT: api.envVar('LOG_FORMAT'),
    LEGACY_AUTH_HOST: external.privateService('legacy-auth').host,
  },
});

const nightly = acme.cron('nightly-report', {
  runtime: 'node',
  schedule: '0 2 * * *',
  rootDir: 'apps/report',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm report',
  env: { DATABASE_URL: db.connectionPoolString, REPORT_BUCKET: 'acme-reports' },
});

const marketing = acme.staticSite('marketing', {
  rootDir: 'apps/marketing',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  staticPublishPath: './dist',
  routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }],
  headers: [{ path: '/*', name: 'X-Frame-Options', value: 'DENY' }],
  domains: ['acme.com'],
  previews: { generation: 'automatic' },
  env: { NODE_VERSION: '22', API_URL: api.hostport },
});

const value: Blueprint = blueprint({
  previews: { generation: 'automatic', expireAfterDays: 7 },
  resources: [db, cache, settings, auth, api, jobs, nightly, marketing],
});

export default value;
```

`replica` is referenceable but is not a resource, so `resources: [replica]` does not compile.
`external.privateService('legacy-auth')` reaches a service in your Render workspace that this
blueprint does not manage.

Note: the root file imports the app file as `./apps/api/api-service.ts`, with the `.ts` extension.
Node's type stripping resolves the file you name, and it does not rewrite `.js` to `.ts`. For
`tsc` to accept that specifier, set `allowImportingTsExtensions` with `noEmit`, or set
`rewriteRelativeImportExtensions`.

## Warnings

`render-blueprint synth` reports every issue at once, and every warning at once. A warning does
not stop the run.

```console
$ render-blueprint synth
warning api.env.STRIPE_KEY: "api" sets "STRIPE_KEY" with secret() while previews are on. Render does not copy a sync: false variable into a preview environment, so declare it in an environment group the Dashboard manages instead.
Wrote /home/acme/mono/render.yaml
```

## Command line

Both commands walk up from the working directory and take the first `render.ts`, `render.mts`,
`render.js` or `render.mjs` that they find. The file must have one default export: the value that
`blueprint(...)` returns. It must also use erasable TypeScript syntax, because Node strips the
types without a compiler.

```sh
render-blueprint synth    # write the YAML file
render-blueprint check    # compare the committed YAML file against the blueprint
```

- `--file <path>` — the blueprint file, instead of the one the walk finds.
- `--out <path>` — the YAML file to write or to compare. Defaults to `render.yaml` beside the blueprint file.
- `--strict` — treat a warning as a failure. `synth` still writes the file, then fails.
- `--help`, `-h` — print the help.
- `--version`, `-v` — print the installed version.

| Exit code | Meaning                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | The file was written, or the committed file is clean.                                                                                                    |
| 1         | The blueprint is invalid, a file could not be found, loaded, read or written, the command line was wrong, or `--strict` turned a warning into a failure. |
| 2         | The committed file has drifted from the blueprint.                                                                                                       |

`check` is the CI command. The two failure codes are different numbers, so CI can tell a stale
file from a broken one. `check` normalizes both sides before it compares them, so a reformatted
file that says the same thing is still clean. After the diff, it lists the changes to fields that
Render cannot alter in place.

## Names in TypeScript and names in YAML

Every field keeps Render's own name, except these nine.

| TypeScript                                                        | YAML                                            |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| `privateService(…)`                                               | `type: pserv`                                   |
| `staticSite(…)`                                                   | `type: web` + `runtime: static`                 |
| `keyValue(…)`                                                     | `type: keyvalue`                                |
| `env: { KEY: value }`                                             | `envVars: [{ key, … }]`                         |
| `envGroups: [g]`                                                  | `envVars: [{ fromGroup }]`                      |
| `instances`                                                       | `numInstances`                                  |
| `secret()`                                                        | `sync: false`                                   |
| `previews.plan` / `previews.diskSizeGB` on Postgres and Key Value | `previewPlan` / `previewDiskSizeGB`             |
| `extraFields`                                                     | merged into the mapping, and not a Render field |

## Develop

```sh
pnpm install
git config core.hooksPath .githooks   # once per clone: the commit hooks
pnpm check                            # format, lint, typecheck, tests, type tests
pnpm build                            # the ESM bundle, the types and the bin, into dist/
```
