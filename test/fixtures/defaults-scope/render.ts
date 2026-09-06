import { blueprint, withDefaults, type Blueprint } from '../../../src/index.js';

const team = withDefaults({
  region: 'frankfurt',
  repo: 'https://github.com/acme/mono',
  branch: 'main',
  plan: {
    web: 'standard',
    privateService: 'starter',
    worker: 'starter',
    cron: 'starter',
    keyValue: 'standard',
    postgres: 'basic-1gb',
  },
});

// The inner scope wins on branch and adds a root directory the team scope does not set.
const checkout = team.withDefaults({ branch: 'release', rootDir: 'apps/checkout' });

const api = team.web('api', {
  runtime: 'node',
  region: 'oregon',
  rootDir: 'apps/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
});

const checkoutService = checkout.privateService('checkout', {
  runtime: 'node',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
});

const pdf = team.worker('pdf', {
  runtime: 'image',
  image: { url: 'ghcr.io/acme/pdf:1.4.0' },
});

const nightly = team.cron('nightly', {
  runtime: 'docker',
  schedule: '0 3 * * *',
  dockerfilePath: './jobs/Dockerfile',
  startCommand: './report.sh',
});

const site = team.staticSite('site', {
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  staticPublishPath: './dist',
});

const cache = team.keyValue('cache', { ipAllowList: [] });

const records = team.postgres('records');

const value: Blueprint = blueprint({
  resources: [api, checkoutService, pdf, nightly, site, cache, records],
});

export default value;
