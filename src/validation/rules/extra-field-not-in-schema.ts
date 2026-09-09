import { ROOT_NAME, ROOT_SCHEMA_FIELDS } from '../../blueprint/blueprint.js';
import type { JsonObject } from '../../json.js';
import { CRON_SERVICE_SCHEMA_FIELDS } from '../../resources/cron.js';
import { ENV_VAR_GROUP_SCHEMA_FIELDS } from '../../resources/env-group.js';
import { REDIS_SERVER_SCHEMA_FIELDS } from '../../resources/key-value.js';
import { DATABASE_SCHEMA_FIELDS } from '../../resources/postgres.js';
import type { BlueprintResource } from '../../resources/resource.js';
import { SERVER_SERVICE_SCHEMA_FIELDS } from '../../resources/service-fields.js';
import { STATIC_SERVICE_SCHEMA_FIELDS } from '../../resources/static-site.js';
import type { ValidationWarning } from '../issue.js';

interface ClosedDefinition {
  readonly kind: string;
  readonly definition: string;
  readonly fields: readonly string[];
}

// spec §4.8: a static site is read against staticService although it emits type web, and one
// serverService definition covers a web service, a private service and a worker alike.
const closedDefinition = (resource: BlueprintResource): ClosedDefinition => {
  switch (resource.kind) {
    case 'web':
      return {
        kind: 'web service',
        definition: 'serverService',
        fields: SERVER_SERVICE_SCHEMA_FIELDS,
      };
    case 'privateService':
      return {
        kind: 'private service',
        definition: 'serverService',
        fields: SERVER_SERVICE_SCHEMA_FIELDS,
      };
    case 'worker':
      return {
        kind: 'background worker',
        definition: 'serverService',
        fields: SERVER_SERVICE_SCHEMA_FIELDS,
      };
    case 'cron':
      return { kind: 'cron job', definition: 'cronService', fields: CRON_SERVICE_SCHEMA_FIELDS };
    case 'staticSite':
      return {
        kind: 'static site',
        definition: 'staticService',
        fields: STATIC_SERVICE_SCHEMA_FIELDS,
      };
    case 'keyValue':
      return {
        kind: 'Key Value instance',
        definition: 'redisServer',
        fields: REDIS_SERVER_SCHEMA_FIELDS,
      };
    case 'postgres':
      return {
        kind: 'Postgres database',
        definition: 'database',
        fields: DATABASE_SCHEMA_FIELDS,
      };
    case 'envGroup':
      return {
        kind: 'environment group',
        definition: 'envVarGroup',
        fields: ENV_VAR_GROUP_SCHEMA_FIELDS,
      };
  }
};

const unlisted = (
  extraFields: JsonObject | undefined,
  fields: readonly string[],
): readonly string[] => {
  if (extraFields === undefined) return [];

  const listed = new Set<string>(fields);

  return Object.keys(extraFields).filter((key) => !listed.has(key));
};

const rootMessage = (key: string): string =>
  `The blueprint root sets "${key}" through extraFields, and Render's schema lists no such property at the root. The root is closed over the "resources" definition and its own properties, so Render reads the emitted document as invalid rather than ignoring the field.`;

const resourceMessage = (name: string, key: string, closed: ClosedDefinition): string =>
  `"${name}" sets "${key}" through extraFields, and Render's schema lists no such property on a ${closed.kind}. The "${closed.definition}" definition is closed, so Render reads the emitted document as invalid rather than ignoring the field.`;

export const extraFieldNotInSchema = (
  extraFields: JsonObject | undefined,
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const key of unlisted(extraFields, ROOT_SCHEMA_FIELDS)) {
    warnings.push({
      code: 'ExtraFieldNotInSchema',
      at: { resource: ROOT_NAME, field: `extraFields.${key}` },
      message: rootMessage(key),
    });
  }

  for (const resource of resources) {
    const closed = closedDefinition(resource);

    for (const key of unlisted(resource.config.extraFields, closed.fields)) {
      warnings.push({
        code: 'ExtraFieldNotInSchema',
        at: { resource: resource.name, field: `extraFields.${key}` },
        message: resourceMessage(resource.name, key, closed),
      });
    }
  }

  return warnings;
};
