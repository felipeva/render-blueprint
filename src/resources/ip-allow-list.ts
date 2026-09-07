import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

export interface IpAllowListEntry {
  readonly source: string;
  readonly description?: string;
}

export type IpAllowList = readonly IpAllowListEntry[];

// Emission order follows the schema's ipAllowList item property order.
export const IP_ALLOW_LIST_ENTRY_FIELDS = ['source', 'description'] as const;

// spec §7: one entry form serves every kind that takes a list.
const ipAllowListArray = z
  .array(z.strictObject({ source: z.string(), description: z.string().exactOptional() }).readonly())
  .readonly();

type IpAllowListSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof ipAllowListArray>, IpAllowList>
>;

export const IP_ALLOW_LIST_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies IpAllowListSchemaMatchesInterface;

export const ipAllowListSchema: z.ZodType<IpAllowList> = ipAllowListArray;
