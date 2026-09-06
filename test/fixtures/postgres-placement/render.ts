import {
  blueprint,
  environment,
  postgres,
  project,
  readReplica,
  web,
  type Blueprint,
} from '../../../src/index.js';

const replica = readReplica('elephant-replica');

const elephant = postgres('elephant', {
  region: 'oregon',
  plan: 'basic-1gb',
  readReplicas: [replica],
});

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  repo: 'https://github.com/acme/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  env: { DATABASE_URL: elephant.connectionString, REPLICA_URL: replica.connectionString },
});

const archive = postgres('archive', { region: 'oregon', plan: 'basic-256mb' });

const value: Blueprint = blueprint({
  projects: [
    project('acme', {
      environments: [environment('production', { resources: [api, elephant] })],
    }),
  ],
  ungrouped: [archive],
});

export default value;
