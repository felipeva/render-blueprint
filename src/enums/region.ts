import * as z from 'zod';

export const REGIONS = ['oregon', 'ohio', 'frankfurt', 'singapore', 'virginia'] as const;

export type Region = (typeof REGIONS)[number];

export const regionSchema: z.ZodEnum<z.core.util.ToEnum<Region>> = z.enum(REGIONS);
