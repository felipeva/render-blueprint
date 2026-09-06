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
} from '../../../src/index.js';

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
