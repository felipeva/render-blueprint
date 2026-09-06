import {
  blueprint,
  external,
  generated,
  literal,
  readReplica,
  withDefaults,
  type Blueprint,
  type ResourceFactories,
} from '../../../src/index.js';
import { apiService } from './api-service.js';

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
