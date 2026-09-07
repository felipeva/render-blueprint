// Spelled as the author writes them in the record a withDefaults call takes. A plan is one key per
// kind, because the plan enums differ per kind.
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

// Six plan keys land on one field, because a resource holds only its own kind's plan.
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

// One scope's own record, reduced to the keys it declared and frozen, so its identity is the scope:
// a nested scope holds the declaration of the scope it nests inside, not a copy of it. The keys are
// strings rather than DefaultKey because a JavaScript caller can write a key the library does not
// model, and reporting that key is the point of keeping it.
export interface DefaultsDeclaration {
  readonly keys: readonly string[];
}

export interface AppliedDefault {
  readonly key: DefaultKey;
  readonly field: DefaultField;
  readonly scope: DefaultsDeclaration;
}

// The scopes are outer first, and an applied default names the innermost scope that declared it.
// Eligibility is what says a default applies to something at all, so a value a resource or an
// inner scope overrode is still a default that reached a resource that had the field. It is inert:
// nothing emits it, and the unused-default rule and the config issue messages are its only readers.
export interface DefaultsProvenance {
  readonly scopes: readonly DefaultsDeclaration[];
  readonly eligible: readonly DefaultKey[];
  readonly applied: readonly AppliedDefault[];
}
