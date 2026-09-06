import * as z from 'zod';

import { raise } from './raise.js';

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union(
    [
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(jsonValueSchema),
      z.record(z.string(), jsonValueSchema),
    ],
    { error: 'A JSON value is a string, a number, a boolean, null, an array, or an object.' },
  ),
);

// SAFETY: a plain object is the union's only branch whose prototype is Object.prototype. A string,
// number or boolean answers its own wrapper prototype, an array answers Array.prototype, and null
// is excluded before the call, so the predicate holds for every value the union admits.
const isJsonObject = (value: JsonValue): value is JsonObject =>
  value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const childEntries = (value: JsonValue): readonly (readonly [string, JsonValue])[] | undefined => {
  if (Array.isArray(value)) {
    return value.map((child, index): readonly [string, JsonValue] => [String(index), child]);
  }
  return isJsonObject(value) ? Object.entries(value) : undefined;
};

const cyclePath = (root: JsonObject): readonly string[] | undefined => {
  const ancestors = new Set<JsonValue>();

  const walk = (value: JsonValue, path: readonly string[]): readonly string[] | undefined => {
    const children = childEntries(value);
    if (children === undefined) return undefined;
    if (ancestors.has(value)) return path;

    ancestors.add(value);
    for (const [key, child] of children) {
      const found = walk(child, [...path, key]);
      if (found !== undefined) return found;
    }
    ancestors.delete(value);

    return undefined;
  };

  return walk(root, []);
};

export const jsonObjectSchema: z.ZodType<JsonObject> = z
  .record(z.string(), jsonValueSchema, { error: 'This field takes a JSON object.' })
  .superRefine((value, ctx) => {
    const cycle = cyclePath(value);
    if (cycle !== undefined) {
      raise(
        ctx,
        'CyclicExtraFields',
        'This object holds a reference back to itself. YAML would emit an anchor and Render would not resolve it.',
        cycle,
      );
    }
  });
