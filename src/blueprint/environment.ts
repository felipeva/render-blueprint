import * as z from 'zod';

import {
  environmentProtectionSchema,
  type EnvironmentProtection,
} from '../enums/environment-protection.js';
import { networkIsolationSchema, type NetworkIsolation } from '../enums/network-isolation.js';
import type { Equal, Expect } from '../equal.js';
import type { BlueprintResource } from '../resources/resource.js';

export interface EnvironmentNetworking {
  readonly isolation?: NetworkIsolation;
}

export interface EnvironmentPermissions {
  readonly protection?: EnvironmentProtection;
}

export interface EnvironmentConfig {
  readonly resources?: readonly BlueprintResource[];
  readonly networking?: EnvironmentNetworking;
  readonly permissions?: EnvironmentPermissions;
}

export interface Environment {
  readonly name: string;
  readonly resources: readonly BlueprintResource[];
  readonly networking?: EnvironmentNetworking | undefined;
  readonly permissions?: EnvironmentPermissions | undefined;
}

const ENVIRONMENT_NAME_ERROR =
  'An environment name is a non-empty string; Render identifies an environment by its name.';

const resourceValueSchema = z.custom<BlueprintResource>();

const environmentNetworkingSchema = z
  .strictObject(
    { isolation: networkIsolationSchema.exactOptional() },
    { error: 'An environment takes its networking as an object with an isolation.' },
  )
  .readonly();

const environmentPermissionsSchema = z
  .strictObject(
    { protection: environmentProtectionSchema.exactOptional() },
    { error: 'An environment takes its permissions as an object with a protection.' },
  )
  .readonly();

const environmentSchema = z
  .strictObject(
    {
      name: z.string({ error: ENVIRONMENT_NAME_ERROR }).min(1, { error: ENVIRONMENT_NAME_ERROR }),
      resources: z
        .array(resourceValueSchema, {
          error: 'An environment holds a list of the resources that belong to it.',
        })
        .readonly(),
      networking: environmentNetworkingSchema.optional(),
      permissions: environmentPermissionsSchema.optional(),
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
