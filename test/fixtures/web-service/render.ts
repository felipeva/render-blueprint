import { blueprint, web, type Blueprint } from '../../../src/index.js';

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  rootDir: 'apps/api',
  healthCheckPath: '/healthz',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  autoDeployTrigger: 'commit',
  env: {
    NODE_ENV: 'production',
    PORT: 8080,
  },
});

const value: Blueprint = blueprint({ resources: [api] });

export default value;
