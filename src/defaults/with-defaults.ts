import { cron, type CronConfig, type CronJob } from '../resources/cron.js';
import type {
  AppliedDefault,
  DefaultKey,
  DefaultsDeclaration,
  DefaultsProvenance,
} from '../resources/defaults-provenance.js';
import { envGroup, type EnvGroupConfig, type EnvironmentGroup } from '../resources/env-group.js';
import { keyValue, type KeyValueConfig, type KeyValueStore } from '../resources/key-value.js';
import { postgres, type PostgresConfig, type PostgresDatabase } from '../resources/postgres.js';
import {
  privateService,
  type PrivateService,
  type PrivateServiceConfig,
} from '../resources/private-service.js';
import { staticSite, type StaticSite, type StaticSiteConfig } from '../resources/static-site.js';
import { web, type WebConfig, type WebService } from '../resources/web.js';
import { worker, type Worker, type WorkerConfig } from '../resources/worker.js';
import {
  cronDefaults,
  keyValueDefaults,
  postgresDefaults,
  privateServiceDefaults,
  staticSiteDefaults,
  webDefaults,
  workerDefaults,
  type Filled,
  type ScopeValues,
} from './apply-defaults.js';
import type { PlanDefaults, ResourceDefaults } from './resource-defaults.js';

// design B §2.3: the same factory set with the same signatures. An environment group takes no
// default, so a scope hands back the bare factory, and `withDefaults` is a member because scopes
// nest.
export interface ResourceFactories {
  readonly web: (name: string, config: WebConfig) => WebService;
  readonly privateService: (name: string, config: PrivateServiceConfig) => PrivateService;
  readonly worker: (name: string, config: WorkerConfig) => Worker;
  readonly cron: (name: string, config: CronConfig) => CronJob;
  readonly staticSite: (name: string, config: StaticSiteConfig) => StaticSite;
  readonly keyValue: (name: string, config: KeyValueConfig) => KeyValueStore;
  readonly postgres: (name: string, config?: PostgresConfig) => PostgresDatabase;
  readonly envGroup: (name: string, config: EnvGroupConfig) => EnvironmentGroup;
  readonly withDefaults: (defaults: ResourceDefaults) => ResourceFactories;
}

interface Scope {
  readonly values: ScopeValues;
  readonly declarations: readonly DefaultsDeclaration[];
}

const RECORD_FIELDS: ReadonlySet<string> = new Set(['region', 'repo', 'branch', 'rootDir', 'plan']);

const PLAN_FIELDS: ReadonlySet<string> = new Set([
  'web',
  'privateService',
  'worker',
  'cron',
  'keyValue',
  'postgres',
]);

// A JavaScript caller can write a key the record does not model. Keeping it is what turns a
// misspelled default into an unused-default warning rather than into silence.
const unmodeledKeys = (
  record: ResourceDefaults,
  plan: PlanDefaults | undefined,
): readonly string[] => [
  ...Object.keys(record).filter((key) => !RECORD_FIELDS.has(key)),
  ...(plan === undefined
    ? []
    : Object.keys(plan)
        .filter((key) => !PLAN_FIELDS.has(key))
        .map((key) => `plan.${key}`)),
];

// The keys this record declares, as the author spelled them.
const declaredKeys = (
  record: ResourceDefaults,
  plan: PlanDefaults | undefined,
): readonly string[] => {
  const keys: string[] = [];
  const declare = (key: DefaultKey): void => {
    keys.push(key);
  };

  if (record.region !== undefined) declare('region');
  if (record.repo !== undefined) declare('repo');
  if (record.branch !== undefined) declare('branch');
  if (record.rootDir !== undefined) declare('rootDir');

  if (plan !== undefined) {
    if (plan.web !== undefined) declare('plan.web');
    if (plan.privateService !== undefined) declare('plan.privateService');
    if (plan.worker !== undefined) declare('plan.worker');
    if (plan.cron !== undefined) declare('plan.cron');
    if (plan.keyValue !== undefined) declare('plan.keyValue');
    if (plan.postgres !== undefined) declare('plan.postgres');
  }

  return [...keys, ...unmodeledKeys(record, plan)];
};

const filled = <V>(
  own: V | undefined,
  scope: DefaultsDeclaration,
  outer: Filled<V> | undefined,
): Filled<V> | undefined => (own === undefined ? outer : { value: own, scope });

// An inner scope wins over an outer one key by key, and a key it wins carries its own declaration,
// so a key an inner scope shadowed is credited to nobody and reported as unused.
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
  plan: {
    web: filled(plan?.web, scope, outer?.plan.web),
    privateService: filled(plan?.privateService, scope, outer?.plan.privateService),
    worker: filled(plan?.worker, scope, outer?.plan.worker),
    cron: filled(plan?.cron, scope, outer?.plan.cron),
    keyValue: filled(plan?.keyValue, scope, outer?.plan.keyValue),
    postgres: filled(plan?.postgres, scope, outer?.plan.postgres),
  },
});

// The declaration is frozen because its identity is the scope: every resource a scope fills points
// at the same object, and the unused-default rule counts by that identity.
const nest = (outer: Scope | undefined, record: ResourceDefaults): Scope => {
  const plan = record.plan;
  const scope: DefaultsDeclaration = Object.freeze({ keys: declaredKeys(record, plan) });

  return {
    values: scopeValues(outer?.values, record, scope, plan),
    declarations: [...(outer?.declarations ?? []), scope],
  };
};

const factories = (scope: Scope): ResourceFactories => {
  const provenance = (applied: readonly AppliedDefault[]): DefaultsProvenance => ({
    scopes: scope.declarations,
    applied,
  });

  return {
    web: (name, config) => {
      const merged = webDefaults(scope.values, config);
      return { ...web(name, merged.config), defaults: provenance(merged.applied) };
    },
    privateService: (name, config) => {
      const merged = privateServiceDefaults(scope.values, config);
      return { ...privateService(name, merged.config), defaults: provenance(merged.applied) };
    },
    worker: (name, config) => {
      const merged = workerDefaults(scope.values, config);
      return { ...worker(name, merged.config), defaults: provenance(merged.applied) };
    },
    cron: (name, config) => {
      const merged = cronDefaults(scope.values, config);
      return { ...cron(name, merged.config), defaults: provenance(merged.applied) };
    },
    staticSite: (name, config) => {
      const merged = staticSiteDefaults(scope.values, config);
      return { ...staticSite(name, merged.config), defaults: provenance(merged.applied) };
    },
    keyValue: (name, config) => {
      const merged = keyValueDefaults(scope.values, config);
      return { ...keyValue(name, merged.config), defaults: provenance(merged.applied) };
    },
    postgres: (name, config = {}) => {
      const merged = postgresDefaults(scope.values, config);
      return { ...postgres(name, merged.config), defaults: provenance(merged.applied) };
    },
    envGroup,
    withDefaults: (defaults) => factories(nest(scope, defaults)),
  };
};

export const withDefaults = (defaults: ResourceDefaults): ResourceFactories =>
  factories(nest(undefined, defaults));
