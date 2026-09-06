import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { serverPlanSchema, type ServerPlan } from '../enums/plan.js';
import { regionSchema, type Region } from '../enums/region.js';
import { nativeRuntimeSchema, type NativeRuntime } from '../enums/runtime.js';
import type { EnvironmentMap } from '../env/env-value.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import type { EnvironmentGroup } from './env-group.js';
import { optionalCommonServiceFields } from './service-fields.js';

export type HealthCheckPath = `/${string}`;

export interface WebConfig {
  readonly runtime: NativeRuntime;
  readonly region?: Region;
  readonly plan?: ServerPlan;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly healthCheckPath?: HealthCheckPath;
  readonly buildCommand?: string;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly env?: EnvironmentMap;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface WebService {
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
  'rootDir',
  'healthCheckPath',
  'buildCommand',
  'startCommand',
  'preDeployCommand',
  'envVars',
  'autoDeployTrigger',
] as const;

const webConfigSchema = z
  .strictObject({
    ...optionalCommonServiceFields,
    runtime: nativeRuntimeSchema,
    region: regionSchema.exactOptional(),
    plan: serverPlanSchema.exactOptional(),
    healthCheckPath: z
      .templateLiteral(['/', z.string()], {
        error: 'A healthCheckPath is a string starting with "/"; Render requests it from the root.',
      })
      .exactOptional(),
    startCommand: z.string().exactOptional(),
  })
  .readonly();

type WebConfigSchemaMatchesInterface = Expect<Equal<z.infer<typeof webConfigSchema>, WebConfig>>;

export const WEB_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies WebConfigSchemaMatchesInterface;

export const parseWebConfig = (config: WebConfig): z.ZodSafeParseResult<WebConfig> =>
  webConfigSchema.safeParse(config);

export const web = (name: string, config: WebConfig): WebService => ({
  kind: 'web',
  name,
  config,
});
