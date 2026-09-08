import type { ReferenceableServiceType } from '../enums/referenceable-service-type.js';
import type { EnvironmentMap } from '../env/env-value.js';
import { selfEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import { CRON_JOB_FIELDS, type CronJob } from './cron.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import { ENVIRONMENT_GROUP_FIELDS, type EnvironmentGroup } from './env-group.js';
import { KEY_VALUE_STORE_FIELDS, type KeyValueStore } from './key-value.js';
import { POSTGRES_DATABASE_FIELDS, type PostgresDatabase } from './postgres.js';
import { PRIVATE_SERVICE_FIELDS, type PrivateService } from './private-service.js';
import { STATIC_SITE_FIELDS, type StaticSite } from './static-site.js';
import { WEB_SERVICE_FIELDS, type WebService } from './web.js';
import { WORKER_FIELDS, type Worker } from './worker.js';

export type BlueprintResource =
  | WebService
  | PrivateService
  | Worker
  | CronJob
  | StaticSite
  | KeyValueStore
  | PostgresDatabase
  | EnvironmentGroup;

export const RESOURCE_KINDS = [
  'web',
  'privateService',
  'worker',
  'cron',
  'staticSite',
  'keyValue',
  'postgres',
  'envGroup',
] as const;

type ResourceKind = (typeof RESOURCE_KINDS)[number];

type ResourceKindsCoverTheUnion = Expect<Equal<ResourceKind, BlueprintResource['kind']>>;

export const RESOURCE_KINDS_COVER_THE_UNION: true = true satisfies ResourceKindsCoverTheUnion;

export const modeledFields = (resource: BlueprintResource): readonly string[] => {
  switch (resource.kind) {
    case 'web':
      return WEB_SERVICE_FIELDS;
    case 'privateService':
      return PRIVATE_SERVICE_FIELDS;
    case 'worker':
      return WORKER_FIELDS;
    case 'cron':
      return CRON_JOB_FIELDS;
    case 'staticSite':
      return STATIC_SITE_FIELDS;
    case 'keyValue':
      return KEY_VALUE_STORE_FIELDS;
    case 'postgres':
      return POSTGRES_DATABASE_FIELDS;
    case 'envGroup':
      return ENVIRONMENT_GROUP_FIELDS;
  }
};

export const resourceDefaults = (resource: BlueprintResource): DefaultsProvenance | undefined => {
  switch (resource.kind) {
    case 'web':
      return resource.defaults;
    case 'privateService':
      return resource.defaults;
    case 'worker':
      return resource.defaults;
    case 'cron':
      return resource.defaults;
    case 'staticSite':
      return resource.defaults;
    case 'keyValue':
      return resource.defaults;
    case 'postgres':
      return resource.defaults;
    case 'envGroup':
      return undefined;
  }
};

// spec §9 and §5: neither a database nor a Key Value instance carries envVars.
export const resourceEnv = (resource: BlueprintResource): EnvironmentMap | undefined => {
  switch (resource.kind) {
    case 'web':
      return selfEnvironment(resource.config?.env, resource);
    case 'privateService':
      return selfEnvironment(resource.config?.env, resource);
    case 'worker':
      return selfEnvironment(resource.config?.env, resource);
    case 'cron':
      return selfEnvironment(resource.config?.env, resource);
    case 'staticSite':
      return selfEnvironment(resource.config?.env, resource);
    case 'keyValue':
      return undefined;
    case 'postgres':
      return undefined;
    case 'envGroup':
      return resource.config?.env;
  }
};

// spec §6.1: only a service imports a group, and a group never imports another one.
export const resourceEnvGroups = (
  resource: BlueprintResource,
): readonly EnvironmentGroup[] | undefined => {
  switch (resource.kind) {
    case 'web':
      return resource.config.envGroups;
    case 'privateService':
      return resource.config.envGroups;
    case 'worker':
      return resource.config.envGroups;
    case 'cron':
      return resource.config.envGroups;
    case 'staticSite':
      return resource.config.envGroups;
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const sourceRuntime = (resource: BlueprintResource): string | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
      return resource.config?.runtime;
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

// spec §6.2: a fromService reference names a service.
export const serviceReferenceType = (
  resource: BlueprintResource,
): ReferenceableServiceType | undefined => {
  switch (resource.kind) {
    case 'web':
      return 'web';
    case 'privateService':
      return 'pserv';
    case 'worker':
      return 'worker';
    case 'cron':
      return 'cron';
    case 'staticSite':
      return 'static';
    case 'keyValue':
      return 'keyvalue';
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};
