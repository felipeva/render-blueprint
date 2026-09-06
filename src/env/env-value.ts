import * as z from 'zod';

import {
  databaseReferenceValueSchema,
  type DatabaseReferenceValue,
} from '../references/reference-value.js';

export type EnvValue = string | number | DatabaseReferenceValue;

export interface EnvironmentMap {
  readonly [key: string]: EnvValue;
}

const envValueSchema = z.union([z.string(), z.number(), databaseReferenceValueSchema], {
  error:
    'An environment variable value is a string, a number, or a property of a database a handle produced.',
});

export const environmentMapSchema: z.ZodType<EnvironmentMap> = z
  .record(z.string(), envValueSchema)
  .readonly();
