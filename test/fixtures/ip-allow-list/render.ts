import {
  blueprint,
  keyValue,
  postgres,
  staticSite,
  web,
  type Blueprint,
  type IpAllowList,
} from '../../../src/index.js';

// spec §7: one entry form serves every kind that takes a list, so a team writes the office range
// once and hands the same value to a service and to a datastore.
const OFFICE: IpAllowList = [
  { source: '203.0.113.4/30', description: 'office' },
  { source: '198.51.100.1', description: 'ci runner' },
];

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  maxShutdownDelaySeconds: 60,
  ipAllowList: OFFICE,
});

// spec §7: an empty list is the value that blocks every external connection.
const marketing = staticSite('marketing', {
  repo: 'https://github.com/acme/marketing',
  branch: 'main',
  buildCommand: 'pnpm build',
  staticPublishPath: './dist',
  ipAllowList: [],
});

const cache = keyValue('cache', {
  region: 'oregon',
  plan: 'starter',
  ipAllowList: [{ source: '::1', description: 'loopback' }],
});

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  ipAllowList: OFFICE,
});

const value: Blueprint = blueprint({ resources: [api, marketing, cache, elephant] });

export default value;
