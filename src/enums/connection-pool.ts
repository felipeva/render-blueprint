import * as z from 'zod';

// spec §9: `none` for a new instance, and an existing one retains its current pool.
export const CONNECTION_POOLS = ['pgbouncer', 'none'] as const;

export type ConnectionPool = (typeof CONNECTION_POOLS)[number];

export const connectionPoolSchema: z.ZodEnum<z.core.util.ToEnum<ConnectionPool>> =
  z.enum(CONNECTION_POOLS);
