import type { JsonObject, JsonValue } from "../json.js";

export interface MappingValues {
  readonly [key: string]: JsonValue | undefined;
}

// An omitted key means "retain current" on Render — spec §12.
export const mapping = (
  order: readonly string[],
  values: MappingValues,
  extraFields: JsonObject | undefined,
): JsonObject => {
  const pairs = new Map<string, JsonValue>();

  for (const key of order) {
    const value = values[key];
    if (value !== undefined) pairs.set(key, value);
  }

  if (extraFields !== undefined) {
    for (const [key, value] of Object.entries(extraFields)) pairs.set(key, value);
  }

  return Object.fromEntries(pairs);
};
