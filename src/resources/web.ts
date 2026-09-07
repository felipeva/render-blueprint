import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { serverPlanSchema, type ServerPlan } from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import {
  httpServiceReference,
  type HttpServiceReference,
} from '../references/http-service-reference.js';
import type { BuildFilter } from './build-filter.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import { raiseDiskPreventsScaling, type Disk } from './disk.js';
import type { EnvironmentGroup } from './env-group.js';
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

export type HealthCheckPath = `/${string}`;

// spec §4.1: domains and healthCheckPath sit on the serverService branch, and the prose gives both
// to web services alone, so a worker and a private service model neither.
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
  readonly disk?: Disk;
  readonly buildFilter?: BuildFilter;
  readonly previews?: ServicePreviews;
  readonly maxShutdownDelaySeconds?: number;
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
  'disk',
  'buildFilter',
  'previews',
  'maxShutdownDelaySeconds',
] as const;

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
  env: serviceEnvironmentSchema<HttpServiceReference>().exactOptional(),
};

const webConfigSchema = z
  .discriminatedUnion('runtime', [
    z.strictObject({ ...webFields, ...nativeSourceFields }).readonly(),
    z.strictObject({ ...webFields, ...dockerSourceFields }).readonly(),
    z.strictObject({ ...webFields, ...imageSourceFields }).readonly(),
  ])
  .superRefine(raiseDiskPreventsScaling);

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
