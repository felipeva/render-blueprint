import * as z from 'zod';

import { AUTO_DEPLOY_TRIGGERS, type AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { ROUTE_TYPES, type RouteType } from '../enums/route-type.js';
import type { EnvironmentMap } from '../env/env-value.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { raise } from '../raise.js';

export interface Route {
  readonly type: RouteType;
  readonly source: string;
  readonly destination: string;
}

export interface Header {
  readonly path: string;
  readonly name: string;
  readonly value: string;
}

export interface StaticSiteConfig {
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly buildCommand?: string;
  readonly preDeployCommand?: string;
  readonly staticPublishPath?: string;
  readonly routes?: readonly Route[];
  readonly headers?: readonly Header[];
  readonly domains?: readonly string[];
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly env?: EnvironmentMap;
  readonly extraFields?: JsonObject;
}

export interface StaticSite {
  readonly kind: 'staticSite';
  readonly name: string;
  readonly config: StaticSiteConfig;
}

// Emission order follows the schema's staticService property order.
export const STATIC_SITE_FIELDS = [
  'type',
  'name',
  'runtime',
  'buildCommand',
  'staticPublishPath',
  'headers',
  'routes',
  'envVars',
  'rootDir',
  'repo',
  'branch',
  'domains',
  'autoDeployTrigger',
  'preDeployCommand',
] as const;

export const HEADER_FIELDS = ['path', 'name', 'value'] as const;

export const ROUTE_FIELDS = ['type', 'source', 'destination'] as const;

const envValueSchema = z.union([z.string(), z.number()], {
  error: 'An environment variable value is a string or a number.',
});

const routeSchema = z
  .strictObject({
    type: z.enum(ROUTE_TYPES),
    source: z.string(),
    destination: z.string(),
  })
  .readonly();

const headerSchema = z
  .strictObject({
    path: z.string(),
    name: z.string(),
    value: z.string(),
  })
  .readonly();

const staticSiteConfigSchema = z
  .strictObject({
    repo: z.string().exactOptional(),
    branch: z.string().exactOptional(),
    rootDir: z
      .string()
      .superRefine((value, ctx) => {
        // spec §4.1 makes rootDir relative to the repository root. INFERRED: the schema does not.
        if (value.startsWith('/')) {
          raise(
            ctx,
            'RootDirNotRelative',
            'A rootDir is relative to the repository root, so it does not start with "/".',
            [],
          );
        }
      })
      .exactOptional(),
    buildCommand: z.string().exactOptional(),
    preDeployCommand: z.string().exactOptional(),
    staticPublishPath: z.string().exactOptional(),
    routes: z.array(routeSchema).readonly().exactOptional(),
    headers: z.array(headerSchema).readonly().exactOptional(),
    domains: z.array(z.string()).readonly().exactOptional(),
    autoDeployTrigger: z.enum(AUTO_DEPLOY_TRIGGERS).exactOptional(),
    env: z.record(z.string(), envValueSchema).readonly().exactOptional(),
    extraFields: jsonObjectSchema.exactOptional(),
  })
  .readonly();

type StaticSiteConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof staticSiteConfigSchema>, StaticSiteConfig>
>;

export const STATIC_SITE_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies StaticSiteConfigSchemaMatchesInterface;

export const parseStaticSiteConfig = (
  config: StaticSiteConfig,
): z.ZodSafeParseResult<StaticSiteConfig> => staticSiteConfigSchema.safeParse(config);

export const staticSite = (name: string, config: StaticSiteConfig): StaticSite => ({
  kind: 'staticSite',
  name,
  config,
});
