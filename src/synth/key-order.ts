export { BLUEPRINT_FIELDS as ROOT_KEY_ORDER } from '../blueprint/blueprint.js';

export const ROOT_PREVIEWS_KEY_ORDER = ['generation', 'expireAfterDays'] as const;

export const PROJECT_KEY_ORDER = ['name', 'environments'] as const;

export const ENVIRONMENT_KEY_ORDER = ['name', 'services', 'networking', 'permissions'] as const;

export const ENVIRONMENT_NETWORKING_KEY_ORDER = ['isolation'] as const;

export const ENVIRONMENT_PERMISSIONS_KEY_ORDER = ['protection'] as const;

export const UNGROUPED_KEY_ORDER = ['services'] as const;

export const ENV_VAR_KEY_ORDER = ['key', 'value'] as const;
