import {
  blueprint,
  envGroup,
  generated,
  literal,
  secret,
  web,
  type Blueprint,
} from '../../../src/index.js';

const settings = envGroup('shared-settings', {
  env: {
    LOG_LEVEL: literal('info'),
    SESSION_SECRET: generated(),
  },
});

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  envGroups: [settings],
  env: {
    NODE_ENV: 'production',
    LOG_FORMAT: literal('json', { previewValue: 'pretty' }),
    STRIPE_KEY: secret(),
  },
});

const value: Blueprint = blueprint({ resources: [api, settings] });

export default value;
