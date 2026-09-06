import { blueprint, postgres, readReplica, web, type Blueprint } from '../../../src/index.js';

const replica = readReplica('elephant-replica');

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  databaseName: 'elephant',
  user: 'elephant_user',
  postgresMajorVersion: '17',
  diskSizeGB: 35,
  highAvailability: { enabled: true },
  ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }, { source: '198.51.100.1' }],
  readReplicas: [replica],
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
    NODE_ENV: 'production',
    DATABASE_URL: elephant.connectionString,
    REPLICA_URL: replica.connectionString,
  },
});

const value: Blueprint = blueprint({ resources: [api, elephant] });

export default value;
