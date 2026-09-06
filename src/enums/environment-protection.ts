import * as z from 'zod';

export const ENVIRONMENT_PROTECTIONS = ['enabled', 'disabled'] as const;

export type EnvironmentProtection = (typeof ENVIRONMENT_PROTECTIONS)[number];

export const environmentProtectionSchema: z.ZodEnum<{ [K in EnvironmentProtection]: K }> =
  z.enum(ENVIRONMENT_PROTECTIONS);
