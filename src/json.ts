export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

const isJsonArray = (value: JsonValue): value is readonly JsonValue[] => Array.isArray(value);

export const asJsonArray = (value: JsonValue): readonly JsonValue[] | undefined =>
  isJsonArray(value) ? value : undefined;

export const asJsonObject = (value: JsonValue): JsonObject | undefined =>
  value !== null && !isJsonArray(value) && value instanceof Object ? value : undefined;
