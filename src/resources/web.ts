import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { serverPlanSchema, type ServerPlan } from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import {
  renderSubdomainPolicySchema,
  type RenderSubdomainPolicy,
} from '../enums/render-subdomain-policy.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import { raise } from '../raise.js';
import {
  httpServiceReference,
  type HttpServiceReference,
} from '../references/http-service-reference.js';
import type { BuildFilter } from './build-filter.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import { raiseDiskPreventsScaling, type Disk } from './disk.js';
import type { EnvironmentGroup } from './env-group.js';
import { ipAllowListSchema, type IpAllowList } from './ip-allow-list.js';
import { servicePreviewsSchema, type ServicePreviews } from './previews.js';
import type { Scaling } from './scaling.js';
import { optionalServerServiceFields, optionalSourcedServiceFields } from './service-fields.js';
import {
  dockerSourceFields,
  imageSourceFields,
  nativeSourceFields,
  type DockerSource,
  type ImageSource,
  type NativeSource,
} from './service-source.js';
import { raiseSubdomainPolicyNeedsDomain } from './subdomain-policy.js';

export type HealthCheckPath = `/${string}`;

// spec §4.8: maintenance mode sits on the serverService branch and Render's prose gives it to a
// paid web service.
export interface MaintenanceMode {
  readonly enabled?: boolean;
  readonly uri?: string;
}

// spec §4.1: domains and healthCheckPath sit on the serverService branch.
interface WebFields {
  readonly region?: Region;
  readonly plan?: ServerPlan;
  readonly instances?: number;
  readonly healthCheckPath?: HealthCheckPath;
  readonly scaling?: Scaling;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly domains?: readonly string[];
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly initialDeployHook?: string;
  readonly disk?: Disk;
  readonly buildFilter?: BuildFilter;
  readonly previews?: ServicePreviews;
  readonly maintenanceMode?: MaintenanceMode;
  readonly maxShutdownDelaySeconds?: number;
  readonly ipAllowList?: IpAllowList;
  readonly renderSubdomainPolicy?: RenderSubdomainPolicy;
  readonly env?: ServiceEnvironment<HttpServiceReference>;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface NativeWebConfig extends WebFields, NativeSource {}

export interface DockerWebConfig extends WebFields, DockerSource {}

export interface ImageWebConfig extends WebFields, ImageSource {}

export type WebConfig = NativeWebConfig | DockerWebConfig | ImageWebConfig;

export interface WebService extends HttpServiceReference {
  readonly kind: 'web';
  readonly name: string;
  readonly config: WebConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's serverService property order.
export const WEB_SERVICE_FIELDS = [
  'type',
  'name',
  'region',
  'plan',
  'runtime',
  'repo',
  'branch',
  'image',
  'rootDir',
  'dockerCommand',
  'dockerContext',
  'dockerfilePath',
  'numInstances',
  'healthCheckPath',
  'scaling',
  'buildCommand',
  'startCommand',
  'preDeployCommand',
  'registryCredential',
  'domains',
  'envVars',
  'autoDeployTrigger',
  'initialDeployHook',
  'disk',
  'buildFilter',
  'previews',
  'maintenanceMode',
  'maxShutdownDelaySeconds',
  'ipAllowList',
  'renderSubdomainPolicy',
] as const;

// Emission order follows the schema's maintenanceMode property order.
export const MAINTENANCE_MODE_FIELDS = ['enabled', 'uri'] as const;

// A browser fetches the maintenance page, so the URL needs a host.
const isAbsolutePageUrl = (value: string): boolean => {
  const parsed = URL.parse(value);
  return parsed !== null && parsed.host !== '';
};

// spec §8.3: the published schema gives the uri format "uri" and the prose calls it absolute.
// INFERRED: the prose also forbids a uri pointing at the service it protects, which no value on
// its own can be read against, so the library checks the form and leaves the target unstated.
const maintenanceModeObject = z
  .strictObject({ enabled: z.boolean().exactOptional(), uri: z.string().exactOptional() })
  .readonly()
  .superRefine((value, ctx) => {
    if (value.uri !== undefined && !isAbsolutePageUrl(value.uri)) {
      raise(
        ctx,
        'MaintenanceUriNotAbsolute',
        `Render serves a maintenance page from an absolute URL with a host, and "${value.uri}" is not one.`,
        ['uri'],
      );
    }
  });

const webFields = {
  ...optionalSourcedServiceFields,
  ...optionalServerServiceFields,
  plan: serverPlanSchema.exactOptional(),
  domains: z.array(z.string()).readonly().exactOptional(),
  previews: servicePreviewsSchema(serverPlanSchema).exactOptional(),
  healthCheckPath: z
    .templateLiteral(['/', z.string()], {
      error: 'A healthCheckPath is a string starting with "/"; Render requests it from the root.',
    })
    .exactOptional(),
  ipAllowList: ipAllowListSchema.exactOptional(),
  initialDeployHook: z.string().exactOptional(),
  maintenanceMode: maintenanceModeObject.exactOptional(),
  renderSubdomainPolicy: renderSubdomainPolicySchema.exactOptional(),
  env: serviceEnvironmentSchema<HttpServiceReference>().exactOptional(),
};

const webConfigSchema = z
  .discriminatedUnion('runtime', [
    z.strictObject({ ...webFields, ...nativeSourceFields }).readonly(),
    z.strictObject({ ...webFields, ...dockerSourceFields }).readonly(),
    z.strictObject({ ...webFields, ...imageSourceFields }).readonly(),
  ])
  .superRefine(raiseDiskPreventsScaling)
  .superRefine(raiseSubdomainPolicyNeedsDomain);

type WebConfigSchemaMatchesInterface = Expect<Equal<z.infer<typeof webConfigSchema>, WebConfig>>;

export const WEB_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies WebConfigSchemaMatchesInterface;

export const parseWebConfig = (config: WebConfig): z.ZodSafeParseResult<WebConfig> =>
  webConfigSchema.safeParse(config);

export const web = (name: string, config: WebConfig): WebService => ({
  kind: 'web',
  name,
  config,
  ...httpServiceReference({ name, type: 'web', origin: 'blueprint' }),
});
