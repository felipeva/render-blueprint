import type { JsonObject, JsonValue } from "../json.js";

export interface MappingValues {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * The one way this library builds a YAML mapping: `order` fixes the emitted key order, an
 * undefined value is omitted rather than written, and `extraFields` merges shallowly afterwards.
 * Omission means "retain current" on Render, so a key with no value must never reach the file.
 */
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
