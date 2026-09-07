import { blueprint, withDefaults, type Blueprint, type IpAllowList } from '../../../src/index.js';

// spec §7: one entry form serves every kind that takes a list, so the team writes the office range
// once and the scope hands the same value to a service, a site and a database.
const OFFICE: IpAllowList = [{ source: '203.0.113.4/30', description: 'office' }];

const team = withDefaults({
  region: 'frankfurt',
  repo: 'https://github.com/acme/mono',
  branch: 'main',
  autoDeployTrigger: 'checksPass',
  buildFilter: { paths: ['apps/**'], ignoredPaths: ['docs/**'] },
  ipAllowList: OFFICE,
  plan: {
    web: 'standard',
    privateService: 'starter',
    worker: 'starter',
    cron: 'starter',
    keyValue: 'standard',
    postgres: 'basic-1gb',
  },
});

// The inner scope wins on branch and on the build filter, adds a root directory the team scope does
// not set, and inherits the deploy trigger and the allow list key by key.
const checkout = team.withDefaults({
  branch: 'release',
  rootDir: 'apps/checkout',
  buildFilter: { paths: ['apps/checkout/**'] },
});

// The resource overrides the deploy trigger, and its own value replaces the scope's.
const api = team.web('api', {
  runtime: 'node',
  region: 'oregon',
  rootDir: 'apps/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  autoDeployTrigger: 'commit',
});

const checkoutService = checkout.privateService('checkout', {
  runtime: 'node',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
});

// spec §4.3: a prebuilt image names no repository, so neither the build filter nor the deploy
// trigger the team scope declares reaches this worker.
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

// The resource overrides the build filter whole: neither list is joined to the scope's.
const site = team.staticSite('site', {
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  staticPublishPath: './dist',
  buildFilter: { paths: ['sites/marketing/**'] },
});

// spec §5: a Key Value instance requires its own allow list, so the scope's never reaches one.
const cache = team.keyValue('cache', { ipAllowList: [] });

// The resource overrides the allow list with the empty list that blocks every connection.
const records = team.postgres('records', { ipAllowList: [] });

const value: Blueprint = blueprint({
  resources: [api, checkoutService, pdf, nightly, site, cache, records],
});

export default value;
