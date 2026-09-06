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

export type HealthCheckPath = `/${string}`;

interface WebFields {
  readonly region?: Region;
  readonly plan?: ServerPlan;
  readonly healthCheckPath?: HealthCheckPath;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
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
  'healthCheckPath',
  'buildCommand',
  'startCommand',
  'preDeployCommand',
  'envVars',
  'autoDeployTrigger',
] as const;

const webFields = {
  ...optionalSourcedServiceFields,
  plan: serverPlanSchema.exactOptional(),
  healthCheckPath: z
    .templateLiteral(['/', z.string()], {
      error: 'A healthCheckPath is a string starting with "/"; Render requests it from the root.',
    })
    .exactOptional(),
  env: serviceEnvironmentSchema<HttpServiceReference>().exactOptional(),
};

const webConfigSchema = z.discriminatedUnion('runtime', [
  z.strictObject({ ...webFields, ...nativeSourceFields }).readonly(),
  z.strictObject({ ...webFields, ...dockerSourceFields }).readonly(),
  z.strictObject({ ...webFields, ...imageSourceFields }).readonly(),
]);

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
