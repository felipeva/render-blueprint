import * as z from 'zod';

// spec §8.2: Render takes the major version as a string, never a number.
export const POSTGRES_MAJOR_VERSIONS = [
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
] as const;

export type PostgresMajorVersion = (typeof POSTGRES_MAJOR_VERSIONS)[number];

export const postgresMajorVersionSchema: z.ZodEnum<z.core.util.ToEnum<PostgresMajorVersion>> =
  z.enum(POSTGRES_MAJOR_VERSIONS);
