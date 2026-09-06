import {
  blueprint,
  external,
  keyValue,
  postgres,
  web,
  type Blueprint,
} from '../../../src/index.js';

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  databaseName: 'acme',
  user: 'acme_user',
});

const cache = keyValue('cache', {
  region: 'oregon',
  plan: '256mb',
  ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
  maxmemoryPolicy: 'allkeys-lru',
  persistenceMode: 'journal-snapshot',
});

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  env: (self) => ({
    NODE_ENV: 'production',
    APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME'),
    DATABASE_URL: elephant.connectionString,
    CACHE_URL: cache.connectionString,
    SESSION_SECRET: 'set-in-the-dashboard',
    AUTH_HOSTPORT: external.privateService('legacy-auth').hostport,
  }),
});

const billing = web('billing', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/billing',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  env: {
    API_HOSTPORT: api.hostport,
    API_SESSION_SECRET: api.envVar('SESSION_SECRET'),
  },
});

const value: Blueprint = blueprint({ resources: [api, billing, cache, elephant] });

export default value;
