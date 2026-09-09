import * as z from 'zod';

import { envGroupEnvironmentSchema, type EnvGroupEnvironment } from '../env/env-value.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';

export interface EnvGroupConfig {
  readonly env: EnvGroupEnvironment;
  readonly extraFields?: JsonObject;
}

export interface EnvironmentGroup {
  readonly kind: 'envGroup';
  readonly name: string;
  readonly config: EnvGroupConfig;
}

// Emission order follows the schema's envVarGroup property order.
export const ENVIRONMENT_GROUP_FIELDS = ['name', 'envVars'] as const;

// spec §4.8: Render closes the envVarGroup definition, so an environment group takes no property
// beyond these.
export const ENV_VAR_GROUP_SCHEMA_FIELDS = ['name', 'envVars'] as const;

const envGroupConfigSchema = z
  .strictObject({
    env: envGroupEnvironmentSchema,
    extraFields: jsonObjectSchema.exactOptional(),
  })
  .readonly();

type EnvGroupConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof envGroupConfigSchema>, EnvGroupConfig>
>;

export const ENV_GROUP_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies EnvGroupConfigSchemaMatchesInterface;

export const parseEnvGroupConfig = (config: EnvGroupConfig): z.ZodSafeParseResult<EnvGroupConfig> =>
  envGroupConfigSchema.safeParse(config);

const groupSchema = z
  .strictObject(
    {
      kind: z.literal('envGroup'),
      name: z.string(),
      config: envGroupConfigSchema,
    },
    {
      error:
        'An environment group is the value envGroup(name, config) returned; this entry is not one.',
    },
  )
  .readonly();

type GroupSchemaMatchesInterface = Expect<Equal<z.infer<typeof groupSchema>, EnvironmentGroup>>;

export const ENVIRONMENT_GROUP_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies GroupSchemaMatchesInterface;

export const environmentGroupSchema: z.ZodType<EnvironmentGroup> = groupSchema;

export const envGroup = (name: string, config: EnvGroupConfig): EnvironmentGroup => ({
  kind: 'envGroup',
  name,
  config,
});
