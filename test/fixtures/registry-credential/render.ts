import { blueprint, cron, external, worker, type Blueprint } from '../../../src/index.js';

const credential = external.registryCredential('acme-dockerhub');

const jobs = worker('jobs', {
  runtime: 'docker',
  region: 'oregon',
  plan: '1c-2g',
  repo: 'https://github.com/acme/jobs',
  branch: 'main',
  dockerfilePath: './Dockerfile.jobs',
  dockerContext: './',
  dockerCommand: 'node jobs.js',
  registryCredential: credential,
  env: { JOBS_LOG_LEVEL: 'info' },
});

const nightly = cron('nightly-report', {
  runtime: 'docker',
  region: 'oregon',
  plan: '0.5c-512mb',
  schedule: '0 2 * * *',
  repo: 'https://github.com/acme/report',
  branch: 'main',
  rootDir: 'apps/report',
  dockerfilePath: './Dockerfile.report',
  registryCredential: credential,
  env: { REPORT_WINDOW_DAYS: 7 },
});

const value: Blueprint = blueprint({ resources: [jobs, nightly] });

export default value;
