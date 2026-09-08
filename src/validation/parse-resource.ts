import * as z from 'zod';

import { environmentMapSchema, type EnvironmentMap } from '../env/env-value.js';
import { isSelfEnvironment } from '../env/self-environment.js';
import { parseCronConfig } from '../resources/cron.js';
import { parseEnvGroupConfig } from '../resources/env-group.js';
import { parseKeyValueConfig } from '../resources/key-value.js';
import { parsePostgresConfig } from '../resources/postgres.js';
import { parsePrivateServiceConfig } from '../resources/private-service.js';
import { RESOURCE_KINDS, resourceEnv, type BlueprintResource } from '../resources/resource.js';
import { parseStaticSiteConfig } from '../resources/static-site.js';
import { parseWebConfig } from '../resources/web.js';
import { parseWorkerConfig } from '../resources/worker.js';

export interface ParsedResource {
  readonly onEntry: readonly z.core.$ZodIssue[];
  readonly onName: readonly z.core.$ZodIssue[];
  readonly onConfig: readonly z.core.$ZodIssue[];
  readonly onEnv: readonly z.core.$ZodIssue[];
}

const listedResourceSchema = z.object(
  { kind: z.enum(RESOURCE_KINDS) },
  { error: 'A resource is the value a factory returned; this entry in resources is not one.' },
);

const resourceEntryIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = listedResourceSchema.safeParse(resource);
  return result.success ? [] : result.error.issues;
};

const RESOURCE_NAME_ERROR =
  'A resource name is a non-empty string; Render identifies a resource by its name.';

const resourceNameSchema = z
  .string({ error: RESOURCE_NAME_ERROR })
  .min(1, { error: RESOURCE_NAME_ERROR });

const nameIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = resourceNameSchema.safeParse(resource.name);
  return result.success ? [] : result.error.issues;
};

const resourceConfigIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
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

// A callback is the author's own code, and resolving it against a config the schema rejected runs
// it on values it was never written for.
const resourceEnvIsCallback = (resource: BlueprintResource): boolean => {
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
const resourceEnvIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const env = unparsedEnv(resource);
  if (env === undefined) return [];

  const result = environmentMapSchema.safeParse(env);
  return result.success ? [] : result.error.issues;
};

export const parseResource = (resource: BlueprintResource): ParsedResource => {
  const onEntry = resourceEntryIssues(resource);
  if (onEntry.length > 0) return { onEntry, onName: [], onConfig: [], onEnv: [] };

  const onName = nameIssues(resource);
  const onConfig = resourceConfigIssues(resource);
  const onEnv =
    onConfig.length === 0 || !resourceEnvIsCallback(resource) ? resourceEnvIssues(resource) : [];

  return { onEntry, onName, onConfig, onEnv };
};
