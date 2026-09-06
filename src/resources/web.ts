import * as z from 'zod';

import { AUTO_DEPLOY_TRIGGERS, type AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { SERVER_PLANS, type ServerPlan } from '../enums/plan.js';
import { REGIONS, type Region } from '../enums/region.js';
import { NATIVE_RUNTIMES, type NativeRuntime } from '../enums/runtime.js';
import type { EnvironmentMap } from '../env/env-value.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';

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

const envValueSchema = z.union([z.string(), z.number()], {
  error: 'An environment variable value is a string or a number.',
});

const webConfigSchema = z
  .strictObject({
    runtime: z.enum(NATIVE_RUNTIMES),
    region: z.enum(REGIONS).exactOptional(),
    plan: z.enum(SERVER_PLANS).exactOptional(),
    repo: z.string().exactOptional(),
    branch: z.string().exactOptional(),
    rootDir: z.string().exactOptional(),
    healthCheckPath: z
      .templateLiteral(['/', z.string()], {
        error: 'A healthCheckPath is a string starting with "/"; Render requests it from the root.',
      })
      .exactOptional(),
    buildCommand: z.string().exactOptional(),
    startCommand: z.string().exactOptional(),
    preDeployCommand: z.string().exactOptional(),
    autoDeployTrigger: z.enum(AUTO_DEPLOY_TRIGGERS).exactOptional(),
    env: z.record(z.string(), envValueSchema).readonly().exactOptional(),
    extraFields: jsonObjectSchema.exactOptional(),
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
