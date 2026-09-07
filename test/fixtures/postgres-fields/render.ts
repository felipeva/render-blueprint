import { blueprint, postgres, web, type Blueprint } from '../../../src/index.js';

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  diskSizeGB: 35,
  storageAutoscalingEnabled: true,
  connectionPool: 'pgbouncer',
  postgresMajorVersion: '18',
  ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
});

const ledger = postgres('ledger', {
  region: 'oregon',
  plan: 'basic-256mb',
  storageAutoscalingEnabled: false,
  connectionPool: 'none',
});

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  env: {
    DATABASE_URL: elephant.connectionPoolString,
    LEDGER_URL: ledger.connectionString,
  },
});

const value: Blueprint = blueprint({ resources: [api, elephant, ledger] });

export default value;
