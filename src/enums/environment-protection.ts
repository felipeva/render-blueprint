import * as z from 'zod';

export const ENVIRONMENT_PROTECTIONS = ['enabled', 'disabled'] as const;

export type EnvironmentProtection = (typeof ENVIRONMENT_PROTECTIONS)[number];

export const environmentProtectionSchema: z.ZodEnum<z.core.util.ToEnum<EnvironmentProtection>> =
  z.enum(ENVIRONMENT_PROTECTIONS);
