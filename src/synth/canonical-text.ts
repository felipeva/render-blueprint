import { Document, type ToStringOptions } from 'yaml';

import type { JsonValue } from '../json.js';

const CANONICAL_OPTIONS: ToStringOptions = { lineWidth: 0, indent: 2 };

// Mapping keys are unordered in YAML 1.2, so sorting them makes a reordered file compare equal.
export const canonicalText = (value: JsonValue): string =>
  new Document(value, { sortMapEntries: true }).toString(CANONICAL_OPTIONS);
