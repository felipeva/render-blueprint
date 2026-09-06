import type { JsonObject } from '../../json.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §16 F: all six sit on the serverService branch a worker and a private service share with a
// web service, and Render's prose gives them to web services alone. The library models none of them
// on the two kinds, so extraFields is the only way one reaches the emitted mapping.
const WEB_ONLY_FIELDS = [
  'healthCheckPath',
  'maintenanceMode',
  'domain',
  'domains',
  'renderSubdomainPolicy',
  'ipAllowList',
] as const;

interface WebOnlyCandidate {
  readonly type: string;
  readonly extraFields: JsonObject;
}

const candidate = (resource: BlueprintResource): WebOnlyCandidate | undefined => {
  switch (resource.kind) {
    case 'privateService':
      return resource.config.extraFields === undefined
        ? undefined
        : { type: 'pserv', extraFields: resource.config.extraFields };
    case 'worker':
      return resource.config.extraFields === undefined
        ? undefined
        : { type: 'worker', extraFields: resource.config.extraFields };
    case 'web':
    case 'cron':
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

// Render neither documents the field on these two kinds nor rejects it in the published schema, so
// a sync may apply it, ignore it, or fail; that unknown is a warning rather than an issue.
export const webOnlyField = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const found = candidate(resource);
    if (found === undefined) continue;

    for (const field of WEB_ONLY_FIELDS) {
      if (found.extraFields[field] === undefined) continue;

      warnings.push({
        code: 'WebOnlyField',
        at: { resource: resource.name, field: `extraFields.${field}` },
        message: `"${resource.name}" sets "${field}" through extraFields, and Render's documentation gives that field to web services. Whether a sync applies it to a "${found.type}" service, ignores it, or fails is unstated.`,
      });
    }
  }

  return warnings;
};
