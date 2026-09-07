import * as z from 'zod';

import type { ReferenceableServiceType } from '../enums/referenceable-service-type.js';
import { environmentMapSchema, type EnvironmentMap } from '../env/env-value.js';
import { isSelfEnvironment, selfEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import { CRON_JOB_FIELDS, parseCronConfig, type CronJob } from './cron.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import {
  ENVIRONMENT_GROUP_FIELDS,
  parseEnvGroupConfig,
  type EnvironmentGroup,
} from './env-group.js';
import { KEY_VALUE_STORE_FIELDS, parseKeyValueConfig, type KeyValueStore } from './key-value.js';
import {
  parsePostgresConfig,
  POSTGRES_DATABASE_FIELDS,
  type PostgresDatabase,
} from './postgres.js';
import {
  parsePrivateServiceConfig,
  PRIVATE_SERVICE_FIELDS,
  type PrivateService,
} from './private-service.js';
import { parseStaticSiteConfig, STATIC_SITE_FIELDS, type StaticSite } from './static-site.js';
import { parseWebConfig, WEB_SERVICE_FIELDS, type WebService } from './web.js';
import { parseWorkerConfig, WORKER_FIELDS, type Worker } from './worker.js';

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

// A defaults scope fills the seven kinds that take a default; a group takes none, so it carries no
// provenance to read.
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

// spec §9 and §5: neither a database nor a Key Value instance carries envVars, so they are the two
// kinds with no environment map. A callback resolves against the resource's own handle.
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

// A callback is the author's own code, and resolving it against a config the schema rejected runs
// it on values it was never written for. A map is inert, so parse-configs parses one either way.
export const resourceEnvIsCallback = (resource: BlueprintResource): boolean => {
  switch (resource.kind) {
    case 'web':
      return isSelfEnvironment(resource.config?.env);
    case 'privateService':
      return isSelfEnvironment(resource.config?.env);
    case 'worker':
      return isSelfEnvironment(resource.config?.env);
    case 'cron':
      return isSelfEnvironment(resource.config?.env);
    case 'staticSite':
      return isSelfEnvironment(resource.config?.env);
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return false;
  }
};

// A service config takes env as it is written, because a callback hides the map behind a call; a
// group's own schema parses the narrower map it takes, and no other kind carries one.
const unparsedEnv = (resource: BlueprintResource): EnvironmentMap | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
    case 'staticSite':
      return resourceEnv(resource);
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

// Resolving the callback first is what puts the failing key, not the whole field, on the issue.
export const resourceEnvIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const env = unparsedEnv(resource);
  if (env === undefined) return [];

  const result = environmentMapSchema.safeParse(env);
  return result.success ? [] : result.error.issues;
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

// The config tier reads this before its schema has parsed, so the value is whatever the author
// wrote. A kind that chooses no source answers with nothing.
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

// spec §6.2: a fromService reference names a service; a database answers fromDatabase instead, and
// a group is no reference target at all.
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

const listedResourceSchema = z.object(
  { kind: z.enum(RESOURCE_KINDS) },
  { error: 'A resource is the value a factory returned; this entry in resources is not one.' },
);

export const resourceEntryIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = listedResourceSchema.safeParse(resource);
  return result.success ? [] : result.error.issues;
};

const RESOURCE_NAME_ERROR =
  'A resource name is a non-empty string; Render identifies a resource by its name.';

const resourceNameSchema = z
  .string({ error: RESOURCE_NAME_ERROR })
  .min(1, { error: RESOURCE_NAME_ERROR });

export const parseResourceName = (name: string): z.ZodSafeParseResult<string> =>
  resourceNameSchema.safeParse(name);

export const resourceConfigIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  switch (resource.kind) {
    case 'web': {
      const result = parseWebConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'privateService': {
      const result = parsePrivateServiceConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'worker': {
      const result = parseWorkerConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'cron': {
      const result = parseCronConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'staticSite': {
      const result = parseStaticSiteConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'keyValue': {
      const result = parseKeyValueConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'postgres': {
      const result = parsePostgresConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
    case 'envGroup': {
      const result = parseEnvGroupConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
  }
};
