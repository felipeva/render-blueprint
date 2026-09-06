import * as z from 'zod';

// spec §6.2: the properties `fromService.property` accepts.
export const SERVICE_PROPERTIES = ['host', 'port', 'hostport', 'connectionString'] as const;

export type ServiceProperty = (typeof SERVICE_PROPERTIES)[number];

export const servicePropertySchema: z.ZodEnum<z.core.util.ToEnum<ServiceProperty>> =
  z.enum(SERVICE_PROPERTIES);
