import {
  blueprint,
  cron,
  external,
  privateService,
  web,
  worker,
  type Blueprint,
} from '../../../src/index.js';

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  healthCheckPath: '/healthz',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
});

const auth = privateService('auth', {
  runtime: 'image',
  region: 'oregon',
  plan: '1c-2g',
  image: {
    url: 'docker.io/acme/auth:1.4.2',
    creds: external.registryCredential('acme-dockerhub'),
  },
  dockerCommand: './auth serve',
  env: { AUTH_LOG_LEVEL: 'info' },
});

const jobs = worker('jobs', {
  runtime: 'docker',
  region: 'oregon',
  plan: '1c-2g',
  repo: 'https://github.com/acme/jobs',
  branch: 'main',
  dockerfilePath: './Dockerfile.jobs',
  dockerContext: './',
  dockerCommand: 'node jobs.js',
  env: {
    API_HOSTPORT: api.hostport,
    AUTH_HOST: auth.host,
    LEGACY_AUTH_HOSTPORT: external.privateService('legacy-auth').hostport,
  },
});

const nightly = cron('nightly-report', {
  runtime: 'node',
  region: 'oregon',
  plan: '0.5c-512mb',
  schedule: '0 2 * * *',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  rootDir: 'apps/report',
  buildCommand: 'pnpm install --frozen-lockfile',
  startCommand: 'pnpm report',
  env: (self) => ({
    REPORT_SERVICE: self.renderVar('RENDER_SERVICE_NAME'),
    API_HOSTPORT: api.hostport,
  }),
});

const value: Blueprint = blueprint({ resources: [api, auth, jobs, nightly] });

export default value;
