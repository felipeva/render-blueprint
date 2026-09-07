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

// spec §4.8: cronService shares no branch with a web service, so the first-deploy hook every
// serverService kind carries is out of reach there too.
const NOT_ON_A_CRON_JOB: readonly string[] = [...WEB_ONLY_FIELDS, 'initialDeployHook'];

// spec §4.8: staticService lists four of the seven.
const ON_A_STATIC_SITE: ReadonlySet<string> = new Set([
  'domain',
  'domains',
  'renderSubdomainPolicy',
  'ipAllowList',
]);

const NOT_ON_A_STATIC_SITE: readonly string[] = NOT_ON_A_CRON_JOB.filter(
  (field) => !ON_A_STATIC_SITE.has(field),
);

interface WebOnlyCandidate {
  readonly type: 'pserv' | 'worker' | 'cron' | 'static';
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
    case 'cron':
      return resource.config.extraFields === undefined
        ? undefined
        : { type: 'cron', extraFields: resource.config.extraFields };
    case 'staticSite':
      return resource.config.extraFields === undefined
        ? undefined
        : { type: 'static', extraFields: resource.config.extraFields };
    case 'web':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

const outOfReach = (type: WebOnlyCandidate['type']): readonly string[] => {
  switch (type) {
    case 'pserv':
    case 'worker':
      return WEB_ONLY_FIELDS;
    case 'cron':
      return NOT_ON_A_CRON_JOB;
    case 'static':
      return NOT_ON_A_STATIC_SITE;
  }
};

// spec §4.8: neither a cron job nor a static site shares the serverService branch.
const message = (name: string, type: WebOnlyCandidate['type'], field: string): string => {
  switch (type) {
    case 'cron':
      return `"${name}" sets "${field}" through extraFields, and Render's schema for a cron job carries no such field. A cron job takes no property beyond the ones cronService lists, so the emitted document is one Render reads as invalid rather than one it ignores the field in.`;
    case 'static':
      return `"${name}" sets "${field}" through extraFields, and Render's schema for a static site carries no such field. A static site takes no property beyond the ones staticService lists, so the emitted document is one Render reads as invalid rather than one it ignores the field in.`;
    case 'pserv':
    case 'worker':
      return `"${name}" sets "${field}" through extraFields, and Render's documentation gives that field to web services. Whether a sync applies it to a "${type}" service, ignores it, or fails is unstated.`;
  }
};

export const webOnlyField = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const found = candidate(resource);
    if (found === undefined) continue;

    for (const field of outOfReach(found.type)) {
      if (found.extraFields[field] === undefined) continue;

      warnings.push({
        code: 'WebOnlyField',
        at: { resource: resource.name, field: `extraFields.${field}` },
        message: message(resource.name, found.type, field),
      });
    }
  }

  return warnings;
};
