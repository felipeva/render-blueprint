import type { JsonValue } from '../json.js';
import { canonicalText } from '../synth/canonical-text.js';
import { parseText } from '../synth/parse-text.js';

export interface NormalizedFile {
  readonly lines: readonly string[];
  readonly value: JsonValue | undefined;
}

const textLines = (text: string): readonly string[] => {
  const lines = text.split('\n').map((line) => line.trimEnd());

  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
};

export const normalize = (text: string): NormalizedFile => {
  const value = parseText(text);

  return {
    lines: textLines(value === undefined ? text : canonicalText(value)),
    value,
  };
};
