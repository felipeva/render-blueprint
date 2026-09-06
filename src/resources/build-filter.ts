import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

// spec §4.1: the two lists are globs relative to the repository root, and spec §12 reads an
// omitted buildFilter as "retain current" while an empty list replaces what the service has.
export interface BuildFilter {
  readonly paths?: readonly string[];
  readonly ignoredPaths?: readonly string[];
}

// Emission order follows the schema's buildFilter property order.
export const BUILD_FILTER_FIELDS = ['paths', 'ignoredPaths'] as const;

const buildFilterObject = z
  .strictObject({
    paths: z.array(z.string()).readonly().exactOptional(),
    ignoredPaths: z.array(z.string()).readonly().exactOptional(),
  })
  .readonly();

type BuildFilterSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof buildFilterObject>, BuildFilter>
>;

export const BUILD_FILTER_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies BuildFilterSchemaMatchesInterface;

export const buildFilterSchema: z.ZodType<BuildFilter> = buildFilterObject;
