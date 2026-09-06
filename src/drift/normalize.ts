import type { JsonValue } from '../json.js';
import { canonicalText } from '../synth/canonical-text.js';
import { parseText } from '../synth/parse-text.js';

export type NormalizedFile =
  | { readonly status: 'parsed'; readonly lines: readonly string[]; readonly value: JsonValue }
  | {
      readonly status: 'malformed';
      readonly lines: readonly string[];
      readonly errors: readonly string[];
    };

const textLines = (text: string): readonly string[] => {
  const lines = text.split('\n').map((line) => line.trimEnd());

  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
};

export const normalize = (text: string): NormalizedFile => {
  const parsed = parseText(text);

  return parsed.status === 'parsed'
    ? { status: 'parsed', lines: textLines(canonicalText(parsed.value)), value: parsed.value }
    : { status: 'malformed', lines: textLines(text), errors: parsed.errors };
};
