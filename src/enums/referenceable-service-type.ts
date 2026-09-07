import * as z from 'zod';

// spec §6.2: `fromService.type` is wider than a service's own type.
// Render also publishes `dpg`, `job` and the retired `redis`.
export const REFERENCEABLE_SERVICE_TYPES = [
  'web',
  'pserv',
  'worker',
  'cron',
  'static',
  'keyvalue',
] as const;

export type ReferenceableServiceType = (typeof REFERENCEABLE_SERVICE_TYPES)[number];

export const referenceableServiceTypeSchema: z.ZodEnum<
  z.core.util.ToEnum<ReferenceableServiceType>
> = z.enum(REFERENCEABLE_SERVICE_TYPES);
