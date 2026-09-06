import * as z from 'zod';

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

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema, {
  error: 'This field takes a JSON object.',
});
