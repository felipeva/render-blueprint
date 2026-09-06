import {
  blueprint,
  cron,
  keyValue,
  postgres,
  staticSite,
  web,
  worker,
  type Blueprint,
} from '../../../src/index.js';

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  instances: 1,
  healthCheckPath: '/healthz',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  domains: ['acme.dev', 'www.acme.dev'],
  disk: { name: 'uploads', mountPath: '/var/data', sizeGB: 20 },
  buildFilter: { paths: ['apps/api/**'], ignoredPaths: ['**/*.md'] },
  previews: { generation: 'automatic', plan: 'starter', instances: 1 },
  maxShutdownDelaySeconds: 60,
});

const jobs = worker('jobs', {
  runtime: 'node',
  region: 'oregon',
  plan: '1c-2g',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  rootDir: 'apps/jobs',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm work',
  scaling: { minInstances: 2, maxInstances: 6, targetMemoryPercent: 75, targetCPUPercent: 70 },
  buildFilter: { paths: ['apps/jobs/**'] },
  previews: { generation: 'manual', plan: '1c-2g', instances: 1 },
  maxShutdownDelaySeconds: 30,
});

const nightly = cron('nightly-report', {
  runtime: 'node',
  region: 'oregon',
  plan: '0.5c-512mb',
  schedule: '0 2 * * *',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  rootDir: 'apps/report',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm report',
  buildFilter: { paths: ['apps/report/**'] },
});

const marketing = staticSite('marketing', {
  repo: 'https://github.com/acme/api',
  branch: 'main',
  rootDir: 'apps/marketing',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  staticPublishPath: './dist',
  previews: { generation: 'automatic' },
  buildFilter: { ignoredPaths: ['**/*.md'] },
});

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  diskSizeGB: 10,
  previews: { plan: 'basic-256mb', diskSizeGB: 5 },
});

const cache = keyValue('cache', {
  ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
  region: 'oregon',
  plan: 'starter',
  previews: { plan: 'free' },
});

const value: Blueprint = blueprint({
  resources: [api, jobs, nightly, marketing, elephant, cache],
});

export default value;
