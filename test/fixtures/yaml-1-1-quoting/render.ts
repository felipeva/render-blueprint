import { blueprint, cron, web, worker, type Blueprint } from '../../../src/index.js';

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  autoDeployTrigger: 'off',
  buildFilter: { paths: ['apps/api/**'], ignoredPaths: ['**/*.md', 'no'] },
  env: {
    ANALYTICS: 'on',
    LEGACY_QUEUE: 'off',
    ACCEPT_TERMS: 'yes',
    ALLOW_SIGNUP: 'no',
    SHORT_TRUE: 'y',
    SHORT_FALSE: 'n',
    LITERAL_TRUE: 'true',
    LITERAL_NULL: 'null',
    TILDE: '~',
    RATE_LIMIT: '1_000',
    OCTAL_LIKE: '0b1',
    MERGE_LIKE: '<<',
    RELEASE_DATE: '2024-01-01',
    REGION_NAME: 'oregon',
    PORT: 3000,
  },
});

const jobs = worker('jobs', {
  runtime: 'node',
  region: 'oregon',
  plan: '0.5c-512mb',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm work',
  autoDeployTrigger: 'commit',
});

const nightly = cron('nightly-report', {
  runtime: 'node',
  region: 'oregon',
  plan: '0.5c-512mb',
  schedule: '0 2 * * *',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm report',
  autoDeployTrigger: 'checksPass',
});

const value: Blueprint = blueprint({
  previews: { generation: 'off' },
  resources: [api, jobs, nightly],
});

export default value;
