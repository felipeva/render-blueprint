import type { JsonObject } from '../../json.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §16 F: the first six sit on the serverService branch a worker and a private service share
// with a web service, and Render's prose gives them to web services alone. A worker, a private
// service and a cron job model none of the seven, so extraFields is the only way one reaches the
// emitted mapping there; a static site models the four ON_A_STATIC_SITE names below and reaches
// the other three the same way.
// spec §4.8: initialDeployHook is the seventh. Its matrix row reaches the whole serverService
// column, so the schema takes it on all three kinds and the restriction to a web service is the
// library's own; the warning is what keeps that choice from passing in silence.
const WEB_ONLY_FIELDS = [
  'healthCheckPath',
  'maintenanceMode',
  'domain',
  'domains',
  'renderSubdomainPolicy',
  'ipAllowList',
  'initialDeployHook',
] as const;

// spec §4.8: staticService lists four of the seven, so a static site is out of reach for the other
// three alone; the library models three of these four and the fourth is the retired singular form.
const ON_A_STATIC_SITE: ReadonlySet<string> = new Set([
  'domain',
  'domains',
  'renderSubdomainPolicy',
  'ipAllowList',
]);

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

const outOfReach = (type: WebOnlyCandidate['type']): readonly string[] =>
  type === 'static'
    ? WEB_ONLY_FIELDS.filter((field) => !ON_A_STATIC_SITE.has(field))
    : WEB_ONLY_FIELDS;

// spec §4 gives initialDeployHook to the whole serverService branch, so naming Render's
// documentation for it would claim a restriction Render does not state.
const restriction = (field: string): string =>
  field === 'initialDeployHook'
    ? 'the library models that field on a web service alone'
    : "Render's documentation gives that field to web services";

// spec §4.8: neither a cron job nor a static site shares the serverService branch, and cronService
// and staticService each allow no property beyond the ones they list, so a field one of them does
// not carry is further out of reach there than on the two kinds the prose merely excludes — the
// emitted document is one Render's own schema rejects rather than one it ignores the field in.
const message = (name: string, type: WebOnlyCandidate['type'], field: string): string => {
  switch (type) {
    case 'cron':
      return `"${name}" sets "${field}" through extraFields, and Render's schema for a cron job carries no such field. A cron job takes no property beyond the ones cronService lists, so the emitted document is one Render reads as invalid rather than one it ignores the field in.`;
    case 'static':
      return `"${name}" sets "${field}" through extraFields, and Render's schema for a static site carries no such field. A static site takes no property beyond the ones staticService lists, so the emitted document is one Render reads as invalid rather than one it ignores the field in.`;
    case 'pserv':
    case 'worker':
      return `"${name}" sets "${field}" through extraFields, and ${restriction(field)}. Whether a sync applies it to a "${type}" service, ignores it, or fails is unstated.`;
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
