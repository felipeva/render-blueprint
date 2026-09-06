import { YAMLMap, type YAMLSeq } from 'yaml';

import type { JsonObject, JsonValue } from '../json.js';

export type MappingValue = JsonValue | YAMLMap | YAMLSeq;

export type MappingValues<K extends string> = { readonly [P in K]: MappingValue | undefined };

// An omitted key means "retain current" on Render — spec §12.
export const mapping = <K extends string>(
  order: readonly K[],
  values: MappingValues<K>,
  extraFields: JsonObject | undefined,
): YAMLMap => {
  const node = new YAMLMap();

  for (const key of order) {
    const value = values[key];
    if (value !== undefined) node.set(key, value);
  }

  if (extraFields !== undefined) {
    for (const [key, value] of Object.entries(extraFields)) {
      if (value !== undefined) node.set(key, value);
    }
  }

  return node;
};
