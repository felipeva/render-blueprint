import {
  blueprint,
  staticSite,
  web,
  type Blueprint,
  type MaintenanceMode,
  type RenderSubdomainPolicy,
} from '../../../src/index.js';

// spec §4.1: `disabled` leaves the custom domains as the only address Render answers on, so both
// resources below list one.
const CUSTOM_DOMAINS_ONLY: RenderSubdomainPolicy = 'disabled';

// spec §4.8: maintenance mode is a web service field, and its uri is an absolute URL Render serves
// the page from while the service is down.
const MAINTENANCE: MaintenanceMode = {
  enabled: false,
  uri: 'https://status.acme.dev/maintenance',
};

const api = web('api', {
  runtime: 'node',
  region: 'oregon',
  plan: 'starter',
  repo: 'https://github.com/acme/api',
  branch: 'main',
  buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
  startCommand: 'pnpm start',
  domains: ['acme.dev', 'www.acme.dev'],
  initialDeployHook: './scripts/seed-database.sh',
  maintenanceMode: MAINTENANCE,
  renderSubdomainPolicy: CUSTOM_DOMAINS_ONLY,
});

// spec §4.8: the subdomain policy is the one of the three a static site takes.
const marketing = staticSite('marketing', {
  repo: 'https://github.com/acme/marketing',
  branch: 'main',
  buildCommand: 'pnpm build',
  staticPublishPath: './dist',
  domains: ['acme.com'],
  renderSubdomainPolicy: CUSTOM_DOMAINS_ONLY,
});

const value: Blueprint = blueprint({ resources: [api, marketing] });

export default value;
