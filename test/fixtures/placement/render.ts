import { blueprint, environment, project, web, type Blueprint } from '../../../src/index.js';

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
});

const staging = web('api-staging', {
  runtime: 'node',
  region: 'oregon',
  repo: 'https://github.com/acme/api',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start --staging',
});

const docs = web('docs', {
  runtime: 'node',
  repo: 'https://github.com/acme/docs',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm serve',
});

const value: Blueprint = blueprint({
  previews: { generation: 'automatic', expireAfterDays: 7 },
  projects: [
    project('acme', {
      environments: [
        environment('production', {
          resources: [api],
          networking: { isolation: 'enabled' },
          permissions: { protection: 'enabled' },
        }),
        environment('staging', { resources: [staging] }),
      ],
    }),
  ],
  ungrouped: [docs],
});

export default value;
