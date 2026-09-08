import {
  DEFAULT_FIELDS,
  type DefaultsDeclaration,
  type DefaultsProvenance,
} from '../resources/defaults-provenance.js';
import type { AppliedConfig, Filled, ScopeValues } from './apply-defaults.js';
import { PLAN_KINDS, type PlanDefaults, type ResourceDefaults } from './resource-defaults.js';

export interface DefaultsScope {
  readonly values: ScopeValues;
  readonly declarations: readonly DefaultsDeclaration[];
}

const RECORD_FIELDS: ReadonlySet<string> = new Set(DEFAULT_FIELDS);

const PLAN_FIELDS: ReadonlySet<string> = new Set(PLAN_KINDS);

// A JavaScript caller can pass anything the CLI's type stripping let through.
const asRecord = <T>(value: T | undefined): T | undefined => {
  const boxed: object = Object(value);

  return boxed === value ? value : undefined;
};

const isPresent = <T>(value: T | undefined): boolean => value !== undefined && value !== null;

// A JavaScript caller can write a key the record does not model.
const unmodeledKeys = (
  record: ResourceDefaults,
  plan: PlanDefaults | undefined,
): readonly string[] => [
  ...Object.keys(record).filter((key) => !RECORD_FIELDS.has(key)),
  ...(plan === undefined && isPresent(record.plan) ? ['plan'] : []),
  ...(plan === undefined
    ? []
    : Object.keys(plan)
        .filter((key) => !PLAN_FIELDS.has(key))
        .map((key) => `plan.${key}`)),
];

// The record half takes its order from DEFAULT_FIELDS, the plan half from PLAN_KINDS: slicing
// "plan." off a dotted key yields string, not a PlanDefaults key. resource-defaults.ts guards both.
const declaredKeys = (
  record: ResourceDefaults,
  plan: PlanDefaults | undefined,
): readonly string[] => [
  ...DEFAULT_FIELDS.filter((field) => field !== 'plan' && record[field] !== undefined),
  ...PLAN_KINDS.filter((kind) => plan?.[kind] !== undefined).map((kind) => `plan.${kind}`),
  ...unmodeledKeys(record, plan),
];

const filled = <V>(
  own: V | undefined,
  scope: DefaultsDeclaration,
  outer: Filled<V> | undefined,
): Filled<V> | undefined => (own === undefined ? outer : { value: own, scope });

const scopeValues = (
  outer: ScopeValues | undefined,
  record: ResourceDefaults,
  scope: DefaultsDeclaration,
  plan: PlanDefaults | undefined,
): ScopeValues => ({
  region: filled(record.region, scope, outer?.region),
  repo: filled(record.repo, scope, outer?.repo),
  branch: filled(record.branch, scope, outer?.branch),
  rootDir: filled(record.rootDir, scope, outer?.rootDir),
  autoDeployTrigger: filled(record.autoDeployTrigger, scope, outer?.autoDeployTrigger),
  buildFilter: filled(record.buildFilter, scope, outer?.buildFilter),
  ipAllowList: filled(record.ipAllowList, scope, outer?.ipAllowList),
  plan: {
    web: filled(plan?.web, scope, outer?.plan.web),
    privateService: filled(plan?.privateService, scope, outer?.plan.privateService),
    worker: filled(plan?.worker, scope, outer?.plan.worker),
    cron: filled(plan?.cron, scope, outer?.plan.cron),
    keyValue: filled(plan?.keyValue, scope, outer?.plan.keyValue),
    postgres: filled(plan?.postgres, scope, outer?.plan.postgres),
  },
});

// The declaration's identity is the scope: every resource a scope fills points at the same object,
// and the unused-default rule counts by that identity.
export const defaultsScope = (
  outer: DefaultsScope | undefined,
  given: ResourceDefaults,
): DefaultsScope => {
  const record: ResourceDefaults = asRecord(given) ?? {};
  const plan = asRecord(record.plan);
  const scope: DefaultsDeclaration = Object.freeze({
    keys: Object.freeze(declaredKeys(record, plan)),
  });

  return {
    values: scopeValues(outer?.values, record, scope, plan),
    declarations: [...(outer?.declarations ?? []), scope],
  };
};

export const scopeProvenance = <T>(
  scope: DefaultsScope,
  merged: AppliedConfig<T>,
): DefaultsProvenance => ({
  scopes: scope.declarations,
  eligible: merged.eligible,
  applied: merged.applied,
});
