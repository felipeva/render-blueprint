import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';
import type { BlueprintResource } from '../resources/resource.js';

export interface EnvironmentConfig {
  readonly resources?: readonly BlueprintResource[];
}

export interface Environment {
  readonly name: string;
  readonly resources: readonly BlueprintResource[];
}

const ENVIRONMENT_NAME_ERROR =
  'An environment name is a non-empty string; Render identifies an environment by its name.';

const resourceValueSchema = z.custom<BlueprintResource>();

const environmentSchema = z
  .strictObject(
    {
      name: z.string({ error: ENVIRONMENT_NAME_ERROR }).min(1, { error: ENVIRONMENT_NAME_ERROR }),
      resources: z
        .array(resourceValueSchema, {
          error: 'An environment holds a list of the resources that belong to it.',
        })
        .readonly(),
    },
    {
      error:
        'An environment is the value environment() returned; this entry in environments is not one.',
    },
  )
  .readonly();

type EnvironmentSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof environmentSchema>, Environment>
>;

export const ENVIRONMENT_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies EnvironmentSchemaMatchesInterface;

export const parseEnvironment = (value: Environment): z.ZodSafeParseResult<Environment> =>
  environmentSchema.safeParse(value);

export const environment = (name: string, config: EnvironmentConfig): Environment => ({
  ...config,
  name,
  resources: config.resources ?? [],
});
