import * as z from 'zod';

import {
  databaseReferenceValueSchema,
  serviceReferenceValueSchema,
  type DatabaseReferenceValue,
  type ServiceReferenceValue,
} from '../references/reference-value.js';
import { generatedValueSchema, type GeneratedValue } from './generated.js';
import { literalValueSchema, type LiteralValue } from './literal.js';
import { secretValueSchema, type SecretValue } from './secret.js';

export type EnvValue =
  | string
  | number
  | LiteralValue
  | SecretValue
  | GeneratedValue
  | DatabaseReferenceValue
  | ServiceReferenceValue;

// spec §6.3: Render ignores a sync: false variable inside a group, and spec §6.1 gives a group's
// items the key-value form only, so no reference reaches one.
export type EnvGroupValue = string | number | LiteralValue | GeneratedValue;

export interface EnvironmentMap {
  readonly [key: string]: EnvValue;
}

export interface EnvGroupEnvironment {
  readonly [key: string]: EnvGroupValue;
}

const envValueSchema = z.union(
  [
    z.string(),
    z.number(),
    literalValueSchema,
    secretValueSchema,
    generatedValueSchema,
    databaseReferenceValueSchema,
    serviceReferenceValueSchema,
  ],
  {
    error:
      'An environment variable value is a string, a number, a literal, a secret, a generated value, or a property of a database or a service a handle produced.',
  },
);

const envGroupValueSchema = z.union(
  [z.string(), z.number(), literalValueSchema, generatedValueSchema],
  {
    error:
      'An environment group variable is a string, a number, a literal, or a generated value. Render ignores a secret inside a group, and a group takes no reference.',
  },
);

export const environmentMapSchema: z.ZodType<EnvironmentMap> = z
  .record(z.string(), envValueSchema)
  .readonly();

export const envGroupEnvironmentSchema: z.ZodType<EnvGroupEnvironment> = z
  .record(z.string(), envGroupValueSchema)
  .readonly();
