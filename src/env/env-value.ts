import * as z from 'zod';

export type EnvValue = string | number;

export interface EnvironmentMap {
  readonly [key: string]: EnvValue;
}

const envValueSchema = z.union([z.string(), z.number()], {
  error: 'An environment variable value is a string or a number.',
});

export const environmentMapSchema: z.ZodType<EnvironmentMap> = z
  .record(z.string(), envValueSchema)
  .readonly();
