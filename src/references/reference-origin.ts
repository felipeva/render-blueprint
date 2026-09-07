import * as z from 'zod';

export const REFERENCE_ORIGINS = ['blueprint', 'external'] as const;

export type ReferenceOrigin = (typeof REFERENCE_ORIGINS)[number];

export const referenceOriginSchema: z.ZodEnum<z.core.util.ToEnum<ReferenceOrigin>> =
  z.enum(REFERENCE_ORIGINS);
