// spec §6.6: the environment variables Render sets on a service.
// Render publishes no schema for them, so this list is the prose's.
export const RENDER_PROVIDED_KEYS = [
  'IS_PULL_REQUEST',
  'PORT',
  'RENDER',
  'RENDER_CPU_COUNT',
  'RENDER_DISCOVERY_SERVICE',
  'RENDER_EXTERNAL_HOSTNAME',
  'RENDER_EXTERNAL_URL',
  'RENDER_GIT_BRANCH',
  'RENDER_GIT_COMMIT',
  'RENDER_GIT_REPO_SLUG',
  'RENDER_INSTANCE_ID',
  'RENDER_SERVICE_ID',
  'RENDER_SERVICE_NAME',
  'RENDER_SERVICE_TYPE',
  'RENDER_WEB_CONCURRENCY',
  'WEB_CONCURRENCY',
] as const;

export type RenderProvidedKey = (typeof RENDER_PROVIDED_KEYS)[number];
