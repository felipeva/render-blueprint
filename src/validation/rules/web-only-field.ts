import type { JsonObject } from '../../json.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §16 F: the six sit on the serverService branch a worker and a private service share with a
// web service, and Render's prose gives each of them to a web service.
const WEB_ONLY_FIELDS = [
  'healthCheckPath',
  'maintenanceMode',
  'domain',
  'domains',
  'renderSubdomainPolicy',
  'ipAllowList',
] as const;

interface WebOnlyCandidate {
  readonly type: 'pserv' | 'worker';
  readonly extraFields: JsonObject;
}

// spec §4.8: neither a cron job nor a static site shares the serverService definition, so the keys
// this rule would name there are the ones that definition's allow list already covers.
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
