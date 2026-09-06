import * as z from 'zod';

// spec §6.2: the properties `fromDatabase.property` accepts.
export const DATABASE_PROPERTIES = [
  'connectionString',
  'connectionPoolString',
  'host',
  'port',
  'user',
  'password',
  'database',
] as const;

export type DatabaseProperty = (typeof DATABASE_PROPERTIES)[number];

export const databasePropertySchema: z.ZodEnum<z.core.util.ToEnum<DatabaseProperty>> =
  z.enum(DATABASE_PROPERTIES);
