import * as z from 'zod';

import type { EnvironmentMap } from '../env/env-value.js';
import type { Equal, Expect } from '../equal.js';
import {
  ENVIRONMENT_GROUP_FIELDS,
  parseEnvGroupConfig,
  type EnvironmentGroup,
} from './env-group.js';
import {
  parsePostgresConfig,
  POSTGRES_DATABASE_FIELDS,
  type PostgresDatabase,
} from './postgres.js';
import { parseStaticSiteConfig, STATIC_SITE_FIELDS, type StaticSite } from './static-site.js';
import { parseWebConfig, WEB_SERVICE_FIELDS, type WebService } from './web.js';

export type BlueprintResource = WebService | StaticSite | PostgresDatabase | EnvironmentGroup;

export const RESOURCE_KINDS = ['web', 'staticSite', 'postgres', 'envGroup'] as const;

type ResourceKind = (typeof RESOURCE_KINDS)[number];

type ResourceKindsCoverTheUnion = Expect<Equal<ResourceKind, BlueprintResource['kind']>>;

export const RESOURCE_KINDS_COVER_THE_UNION: true = true satisfies ResourceKindsCoverTheUnion;

export const modeledFields = (resource: BlueprintResource): readonly string[] => {
  switch (resource.kind) {
    case 'web':
      return WEB_SERVICE_FIELDS;
    case 'staticSite':
      return STATIC_SITE_FIELDS;
    case 'postgres':
      return POSTGRES_DATABASE_FIELDS;
    case 'envGroup':
      return ENVIRONMENT_GROUP_FIELDS;
  }
};

// spec §9: a database carries no envVars, so it is the one kind with no environment map.
export const resourceEnv = (resource: BlueprintResource): EnvironmentMap | undefined => {
  switch (resource.kind) {
    case 'web':
      return resource.config.env;
    case 'staticSite':
      return resource.config.env;
    case 'postgres':
      return undefined;
    case 'envGroup':
      return resource.config.env;
  }
};

// spec §6.1: only a service imports a group, and a group never imports another one.
export const resourceEnvGroups = (
  resource: BlueprintResource,
): readonly EnvironmentGroup[] | undefined => {
  switch (resource.kind) {
    case 'web':
      return resource.config.envGroups;
    case 'staticSite':
      return resource.config.envGroups;
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
    case 'staticSite': {
      const result = parseStaticSiteConfig(resource.config);
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
