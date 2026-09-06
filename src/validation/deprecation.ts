import type { JsonValue } from '../json.js';
import type { BlueprintResource } from '../resources/resource.js';

export const DEPRECATION_SCOPES = ['root', 'service', 'cron', 'datastore', 'envGroup'] as const;

export type DeprecationScope = (typeof DEPRECATION_SCOPES)[number];

export interface Deprecation {
  readonly key: string;
  // Nothing replaces a field on a kind that carries no successor for it either.
  readonly replacement: string | undefined;
}

// spec §13
const REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ['env', 'runtime'],
  ['autoDeploy', 'autoDeployTrigger'],
  ['previewsEnabled', 'previews.generation'],
  ['previewsExpireAfterDays', 'previews.expireAfterDays'],
  ['pullRequestPreviewsEnabled', 'previews.generation'],
  ['previewPlan', 'previews.plan'],
]);

// spec §13: previewPlan is deprecated on a service, and is the current form on a datastore.
const CURRENT_ON_A_DATASTORE: ReadonlySet<string> = new Set(['previewPlan']);

// spec §4.8: cronService carries no previews object and no previewPlan, so the replacement a
// service is pointed at does not exist on a cron job either.
const PREVIEW_FIELDS: ReadonlySet<string> = new Set([
  'previewPlan',
  'previewsEnabled',
  'previewsExpireAfterDays',
  'pullRequestPreviewsEnabled',
]);

export const deprecation = (
  key: string,
  value: JsonValue,
  scope: DeprecationScope,
): Deprecation | undefined => {
  // spec §6.1: a group carries a name and its variables, so no retired field of §13 is one of
  // its fields; naming a replacement for a field a group never had would misdirect the author.
  if (scope === 'envGroup') return undefined;
  if (scope === 'datastore' && CURRENT_ON_A_DATASTORE.has(key)) return undefined;

  if (scope === 'cron' && PREVIEW_FIELDS.has(key)) return { key, replacement: undefined };

  const replacement = REPLACEMENTS.get(key);
  if (replacement !== undefined) return { key, replacement };
  return key === 'type' && value === 'redis' ? { key, replacement: 'keyvalue' } : undefined;
};

export const deprecationScope = (kind: BlueprintResource['kind']): DeprecationScope => {
  switch (kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'staticSite':
      return 'service';
    case 'cron':
      return 'cron';
    case 'keyValue':
    case 'postgres':
      return 'datastore';
    case 'envGroup':
      return 'envGroup';
  }
};

// One sentence for every retired field, so the three rules that report one all say it the same way.
export const deprecationAdvice = (retired: Deprecation): string => {
  if (retired.replacement === undefined) {
    return `Render deprecated "${retired.key}", and a cron job has no previews of its own to name in its place. The escape hatch never emits a retired form.`;
  }

  if (retired.key === 'type') {
    return `Render deprecated the service type "redis"; use "${retired.replacement}". The escape hatch never emits a retired form.`;
  }

  return `Render deprecated "${retired.key}"; use "${retired.replacement}". The escape hatch never emits a retired form.`;
};
