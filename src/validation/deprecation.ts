import type { JsonValue } from '../json.js';
import type { BlueprintResource } from '../resources/resource.js';

export const DEPRECATION_SCOPES = ['root', 'service', 'datastore', 'envGroup'] as const;

export type DeprecationScope = (typeof DEPRECATION_SCOPES)[number];

export interface Deprecation {
  readonly key: string;
  readonly replacement: string;
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

export const deprecation = (
  key: string,
  value: JsonValue,
  scope: DeprecationScope,
): Deprecation | undefined => {
  // spec §6.1: a group carries a name and its variables, so no retired field of §13 is one of
  // its fields; naming a replacement for a field a group never had would misdirect the author.
  if (scope === 'envGroup') return undefined;
  if (scope === 'datastore' && CURRENT_ON_A_DATASTORE.has(key)) return undefined;

  const replacement = REPLACEMENTS.get(key);
  if (replacement !== undefined) return { key, replacement };
  return key === 'type' && value === 'redis' ? { key, replacement: 'keyvalue' } : undefined;
};

export const deprecationScope = (kind: BlueprintResource['kind']): DeprecationScope => {
  switch (kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
    case 'staticSite':
      return 'service';
    case 'keyValue':
    case 'postgres':
      return 'datastore';
    case 'envGroup':
      return 'envGroup';
  }
};
