export { BLUEPRINT_FIELDS as ROOT_KEY_ORDER } from '../blueprint/blueprint.js';

export const ROOT_PREVIEWS_KEY_ORDER = ['generation', 'expireAfterDays'] as const;

export const PROJECT_KEY_ORDER = ['name', 'environments'] as const;

export const ENVIRONMENT_KEY_ORDER = [
  'name',
  'services',
  'databases',
  'envVarGroups',
  'networking',
  'permissions',
] as const;

export const ENVIRONMENT_NETWORKING_KEY_ORDER = ['isolation'] as const;

export const ENVIRONMENT_PERMISSIONS_KEY_ORDER = ['protection'] as const;

export const UNGROUPED_KEY_ORDER = ['services', 'databases', 'envVarGroups'] as const;

export const ENV_VAR_KEY_ORDER = ['key', 'value'] as const;

export const ENV_VAR_LITERAL_KEY_ORDER = ['key', 'value', 'previewValue'] as const;

export const ENV_VAR_SECRET_KEY_ORDER = ['key', 'sync'] as const;

export const ENV_VAR_GENERATED_KEY_ORDER = ['key', 'generateValue'] as const;

export const ENV_VAR_FROM_DATABASE_KEY_ORDER = ['key', 'fromDatabase'] as const;

export const ENV_VAR_FROM_SERVICE_KEY_ORDER = ['key', 'fromService'] as const;

export const ENV_VAR_FROM_GROUP_KEY_ORDER = ['fromGroup'] as const;

export const FROM_DATABASE_KEY_ORDER = ['name', 'property'] as const;

// Emission order follows the schema's envVarFromService fromService property order.
export const FROM_SERVICE_KEY_ORDER = ['type', 'name', 'property', 'envVarKey'] as const;
