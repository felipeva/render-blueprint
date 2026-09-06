import { blueprint, staticSite, type Blueprint } from '../../../src/index.js';

const marketing = staticSite('marketing', {
  repo: 'https://github.com/acme/marketing',
  branch: 'main',
  rootDir: 'apps/marketing',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  preDeployCommand: 'pnpm sitemap',
  staticPublishPath: './dist',
  routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }],
  headers: [{ path: '/*', name: 'X-Frame-Options', value: 'DENY' }],
  domains: ['acme.com'],
  autoDeployTrigger: 'commit',
  env: {
    NODE_VERSION: '22',
    SITE_URL: 'https://acme.com',
  },
});

const value: Blueprint = blueprint({ resources: [marketing] });

export default value;
