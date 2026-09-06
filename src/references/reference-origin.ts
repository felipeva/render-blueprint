import * as z from 'zod';

// A reference a listed resource produced is resolvable against the resource list; one an external
// handle produced names a resource this blueprint does not manage, so no rule can resolve it.
export const REFERENCE_ORIGINS = ['blueprint', 'external'] as const;

export type ReferenceOrigin = (typeof REFERENCE_ORIGINS)[number];

export const referenceOriginSchema: z.ZodEnum<z.core.util.ToEnum<ReferenceOrigin>> =
  z.enum(REFERENCE_ORIGINS);
