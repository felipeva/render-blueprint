import { parseDocument } from 'yaml';

import type { JsonValue } from '../json.js';

export type ParsedText =
  | { readonly status: 'parsed'; readonly value: JsonValue }
  | { readonly status: 'malformed'; readonly errors: readonly string[] };

const PARSE_OPTIONS = { version: '1.2', schema: 'core' } as const;

const firstLine = (message: string): string => message.split('\n')[0] ?? message;

export const parseText = (text: string): ParsedText => {
  const parsed = parseDocument(text, PARSE_OPTIONS);

  if (parsed.errors.length > 0) {
    return { status: 'malformed', errors: parsed.errors.map((error) => firstLine(error.message)) };
  }

  if (parsed.directives.yaml.version !== '1.2') {
    return {
      status: 'malformed',
      errors: [`The document declares %YAML ${parsed.directives.yaml.version}; only 1.2 is read.`],
    };
  }

  // SAFETY: yaml's toJS returns any. The document parsed without errors under the YAML 1.2 core
  // schema and declares no other version, and that schema resolves every node to a string, a
  // number, a boolean, null, an array or a plain object — which is exactly JsonValue.
  const value: JsonValue = parsed.toJS();

  return { status: 'parsed', value };
};
