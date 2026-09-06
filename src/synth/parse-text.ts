import { parseDocument } from 'yaml';

import type { JsonValue } from '../json.js';

export const parseText = (text: string): JsonValue | undefined => {
  const parsed = parseDocument(text);

  if (parsed.errors.length > 0) return undefined;

  // SAFETY: yaml's toJS returns any. A document that parsed without errors resolves under the
  // YAML 1.2 core schema to strings, numbers, booleans, null, arrays and plain objects only.
  const value: JsonValue = parsed.toJS();

  return value;
};
