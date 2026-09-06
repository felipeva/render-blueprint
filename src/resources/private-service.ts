import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { paidServerPlanSchema, type PaidServerPlan } from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import {
  httpServiceReference,
  type HttpServiceReference,
} from '../references/http-service-reference.js';
import type { EnvironmentGroup } from './env-group.js';
import { optionalSourcedServiceFields } from './service-fields.js';
import {
  dockerSourceFields,
  imageSourceFields,
  nativeSourceFields,
  type DockerSource,
  type ImageSource,
  type NativeSource,
} from './service-source.js';

// spec §16 F: healthCheckPath, domains, maintenanceMode and ipAllowList sit on the schema branch a
// private service shares with a web service, and the prose restricts all four to web services.
interface PrivateServiceFields {
  readonly region?: Region;
  readonly plan?: PaidServerPlan;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly env?: ServiceEnvironment<HttpServiceReference>;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface NativePrivateServiceConfig extends PrivateServiceFields, NativeSource {}

export interface DockerPrivateServiceConfig extends PrivateServiceFields, DockerSource {}

export interface ImagePrivateServiceConfig extends PrivateServiceFields, ImageSource {}

export type PrivateServiceConfig =
  | NativePrivateServiceConfig
  | DockerPrivateServiceConfig
  | ImagePrivateServiceConfig;

export interface PrivateService extends HttpServiceReference {
  readonly kind: 'privateService';
  readonly name: string;
  readonly config: PrivateServiceConfig;
}

// Emission order follows the schema's serverService property order.
export const PRIVATE_SERVICE_FIELDS = [
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
  'buildCommand',
  'startCommand',
  'preDeployCommand',
  'envVars',
  'autoDeployTrigger',
] as const;

const privateServiceFields = {
  ...optionalSourcedServiceFields,
  plan: paidServerPlanSchema.exactOptional(),
  env: serviceEnvironmentSchema<HttpServiceReference>().exactOptional(),
};

const privateServiceConfigSchema = z.discriminatedUnion('runtime', [
  z.strictObject({ ...privateServiceFields, ...nativeSourceFields }).readonly(),
  z.strictObject({ ...privateServiceFields, ...dockerSourceFields }).readonly(),
  z.strictObject({ ...privateServiceFields, ...imageSourceFields }).readonly(),
]);

type PrivateServiceConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof privateServiceConfigSchema>, PrivateServiceConfig>
>;

export const PRIVATE_SERVICE_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies PrivateServiceConfigSchemaMatchesInterface;

export const parsePrivateServiceConfig = (
  config: PrivateServiceConfig,
): z.ZodSafeParseResult<PrivateServiceConfig> => privateServiceConfigSchema.safeParse(config);

// spec §6.2: a private service answers on the private network, so it carries host, port and
// hostport; §3.1 spells its type `pserv`.
export const privateService = (name: string, config: PrivateServiceConfig): PrivateService => ({
  kind: 'privateService',
  name,
  config,
  ...httpServiceReference({ name, type: 'pserv', origin: 'blueprint' }),
});
