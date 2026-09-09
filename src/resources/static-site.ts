import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { previewGenerationSchema, type PreviewGeneration } from '../enums/preview-generation.js';
import {
  renderSubdomainPolicySchema,
  type RenderSubdomainPolicy,
} from '../enums/render-subdomain-policy.js';
import { routeTypeSchema, type RouteType } from '../enums/route-type.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import {
  opaqueServiceReference,
  type OpaqueServiceReference,
} from '../references/opaque-service-reference.js';
import type { BuildFilter } from './build-filter.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import type { EnvironmentGroup } from './env-group.js';
import { ipAllowListSchema, type IpAllowList } from './ip-allow-list.js';
import { optionalCommonServiceFields } from './service-fields.js';
import { raiseSubdomainPolicyNeedsDomain } from './subdomain-policy.js';

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

// spec §4.6: staticServicePreviews carries generation alone.
export interface StaticSitePreviews {
  readonly generation?: PreviewGeneration;
}

export interface StaticSiteConfig {
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly buildCommand?: string;
  readonly preDeployCommand?: string;
  readonly staticPublishPath?: string;
  readonly previews?: StaticSitePreviews;
  readonly buildFilter?: BuildFilter;
  readonly routes?: readonly Route[];
  readonly headers?: readonly Header[];
  readonly domains?: readonly string[];
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly ipAllowList?: IpAllowList;
  readonly renderSubdomainPolicy?: RenderSubdomainPolicy;
  readonly env?: ServiceEnvironment<OpaqueServiceReference>;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface StaticSite extends OpaqueServiceReference {
  readonly kind: 'staticSite';
  readonly name: string;
  readonly config: StaticSiteConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's staticService property order.
export const STATIC_SITE_FIELDS = [
  'type',
  'name',
  'runtime',
  'buildCommand',
  'staticPublishPath',
  'previews',
  'buildFilter',
  'headers',
  'routes',
  'envVars',
  'rootDir',
  'repo',
  'branch',
  'domains',
  'autoDeployTrigger',
  'preDeployCommand',
  'ipAllowList',
  'renderSubdomainPolicy',
] as const;

// spec §4.8: Render closes the staticService definition, so a static site takes no property beyond
// these.
export const STATIC_SERVICE_SCHEMA_FIELDS = [
  'type',
  'name',
  'runtime',
  'buildCommand',
  'staticPublishPath',
  'previews',
  'pullRequestPreviewsEnabled',
  'buildFilter',
  'headers',
  'routes',
  'envVars',
  'rootDir',
  'repo',
  'branch',
  'domain',
  'domains',
  'autoDeploy',
  'autoDeployTrigger',
  'preDeployCommand',
  'ipAllowList',
  'renderSubdomainPolicy',
] as const;

export const HEADER_FIELDS = ['path', 'name', 'value'] as const;

// Emission order follows the schema's staticServicePreviews property order.
export const STATIC_SITE_PREVIEWS_FIELDS = ['generation'] as const;

export const ROUTE_FIELDS = ['type', 'source', 'destination'] as const;

const routeSchema = z
  .strictObject({
    type: routeTypeSchema,
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
    ...optionalCommonServiceFields,
    staticPublishPath: z.string().exactOptional(),
    previews: z
      .strictObject({ generation: previewGenerationSchema.exactOptional() })
      .readonly()
      .exactOptional(),
    routes: z.array(routeSchema).readonly().exactOptional(),
    headers: z.array(headerSchema).readonly().exactOptional(),
    domains: z.array(z.string()).readonly().exactOptional(),
    ipAllowList: ipAllowListSchema.exactOptional(),
    renderSubdomainPolicy: renderSubdomainPolicySchema.exactOptional(),
    env: serviceEnvironmentSchema<OpaqueServiceReference>().exactOptional(),
  })
  .readonly()
  .superRefine(raiseSubdomainPolicyNeedsDomain);

type StaticSiteConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof staticSiteConfigSchema>, StaticSiteConfig>
>;

export const STATIC_SITE_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies StaticSiteConfigSchemaMatchesInterface;

export const parseStaticSiteConfig = (
  config: StaticSiteConfig,
): z.ZodSafeParseResult<StaticSiteConfig> => staticSiteConfigSchema.safeParse(config);

// spec §6.2: a static site answers fromService with type "static".
export const staticSite = (name: string, config: StaticSiteConfig): StaticSite => ({
  kind: 'staticSite',
  name,
  config,
  ...opaqueServiceReference({ name, type: 'static', origin: 'blueprint' }),
});
