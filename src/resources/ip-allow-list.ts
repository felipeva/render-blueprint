import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';
import { raise } from '../raise.js';
import { isIpSource } from './ip-source.js';

export interface IpAllowListEntry {
  readonly source: string;
  readonly description?: string;
}

export type IpAllowList = readonly IpAllowListEntry[];

// Emission order follows the schema's ipAllowList item property order.
export const IP_ALLOW_LIST_ENTRY_FIELDS = ['source', 'description'] as const;

const sourceSchema: z.ZodString = z.string().superRefine((value, ctx) => {
  // spec §7: the source is an IP address or a range in CIDR notation.
  if (!isIpSource(value)) {
    raise(
      ctx,
      'IpAllowListSourceNotCidr',
      `"${value}" is not an IP address or a CIDR range; a source is an address such as "203.0.113.4" or a range such as "203.0.113.4/30".`,
      [],
    );
  }
});

// spec §7: one entry form serves every kind that takes a list.
const ipAllowListArray = z
  .array(
    z.strictObject({ source: sourceSchema, description: z.string().exactOptional() }).readonly(),
  )
  .readonly();

type IpAllowListSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof ipAllowListArray>, IpAllowList>
>;

export const IP_ALLOW_LIST_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies IpAllowListSchemaMatchesInterface;

export const ipAllowListSchema: z.ZodType<IpAllowList> = ipAllowListArray;
