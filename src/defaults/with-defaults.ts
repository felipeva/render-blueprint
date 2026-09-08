import { cron, type CronConfig, type CronJob } from '../resources/cron.js';
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
} from './apply-defaults.js';
import { defaultsScope, scopeProvenance, type DefaultsScope } from './defaults-scope.js';
import type { ResourceDefaults } from './resource-defaults.js';

// design B §2.3: the same factory set with the same signatures.
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

const factories = (scope: DefaultsScope): ResourceFactories => ({
  web: (name, config) => {
    const merged = webDefaults(scope.values, config);
    return { ...web(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  privateService: (name, config) => {
    const merged = privateServiceDefaults(scope.values, config);
    return { ...privateService(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  worker: (name, config) => {
    const merged = workerDefaults(scope.values, config);
    return { ...worker(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  cron: (name, config) => {
    const merged = cronDefaults(scope.values, config);
    return { ...cron(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  staticSite: (name, config) => {
    const merged = staticSiteDefaults(scope.values, config);
    return { ...staticSite(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  keyValue: (name, config) => {
    const merged = keyValueDefaults(scope.values, config);
    return { ...keyValue(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  postgres: (name, config = {}) => {
    const merged = postgresDefaults(scope.values, config);
    return { ...postgres(name, merged.config), defaults: scopeProvenance(scope, merged) };
  },
  envGroup,
  withDefaults: (defaults) => factories(defaultsScope(scope, defaults)),
});

export const withDefaults = (defaults: ResourceDefaults): ResourceFactories =>
  factories(defaultsScope(undefined, defaults));
