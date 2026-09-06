import * as z from 'zod';

// spec §5: the blueprint-spec page lists six; the schema and the Key Value docs list these eight.
export const MAXMEMORY_POLICIES = [
  'allkeys-lru',
  'volatile-lru',
  'allkeys-lfu',
  'volatile-lfu',
  'allkeys-random',
  'volatile-random',
  'volatile-ttl',
  'noeviction',
] as const;

export type MaxmemoryPolicy = (typeof MAXMEMORY_POLICIES)[number];

export const maxmemoryPolicySchema: z.ZodEnum<z.core.util.ToEnum<MaxmemoryPolicy>> =
  z.enum(MAXMEMORY_POLICIES);
