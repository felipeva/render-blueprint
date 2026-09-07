export const DEFAULT_KEYS = [
  'region',
  'repo',
  'branch',
  'rootDir',
  'autoDeployTrigger',
  'buildFilter',
  'ipAllowList',
  'plan.web',
  'plan.privateService',
  'plan.worker',
  'plan.cron',
  'plan.keyValue',
  'plan.postgres',
] as const;

export type DefaultKey = (typeof DEFAULT_KEYS)[number];

export const DEFAULT_FIELDS = [
  'region',
  'plan',
  'repo',
  'branch',
  'rootDir',
  'autoDeployTrigger',
  'buildFilter',
  'ipAllowList',
] as const;

export type DefaultField = (typeof DEFAULT_FIELDS)[number];

// The keys are strings rather than DefaultKey because a JavaScript caller can write a key the
// library does not model.
export interface DefaultsDeclaration {
  readonly keys: readonly string[];
}

export interface AppliedDefault {
  readonly key: DefaultKey;
  readonly field: DefaultField;
  readonly scope: DefaultsDeclaration;
}

// The scopes are outer first, and an applied default names the innermost scope that declared it.
export interface DefaultsProvenance {
  readonly scopes: readonly DefaultsDeclaration[];
  readonly eligible: readonly DefaultKey[];
  readonly applied: readonly AppliedDefault[];
}
