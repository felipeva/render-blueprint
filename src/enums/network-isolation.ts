import * as z from 'zod';

export const NETWORK_ISOLATIONS = ['enabled', 'disabled'] as const;

export type NetworkIsolation = (typeof NETWORK_ISOLATIONS)[number];

export const networkIsolationSchema: z.ZodEnum<z.core.util.ToEnum<NetworkIsolation>> =
  z.enum(NETWORK_ISOLATIONS);
