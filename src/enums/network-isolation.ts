import * as z from 'zod';

export const NETWORK_ISOLATIONS = ['enabled', 'disabled'] as const;

export type NetworkIsolation = (typeof NETWORK_ISOLATIONS)[number];

export const networkIsolationSchema: z.ZodEnum<{ [K in NetworkIsolation]: K }> =
  z.enum(NETWORK_ISOLATIONS);
