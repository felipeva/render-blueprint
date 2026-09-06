import { describe, expect, it } from 'vitest';
import { Document, type YAMLMap } from 'yaml';

import type { JsonObject } from '../json.js';
import { mapping } from './mapping.js';

const emit = (node: YAMLMap): string => new Document(node).toString({ lineWidth: 0, indent: 2 });

describe('mapping', () => {
  it('omits an ordered key whose value is undefined', () => {
    expect(emit(mapping(['a', 'b', 'c'] as const, { a: 1, b: undefined, c: 3 }, undefined))).toBe(
      'a: 1\nc: 3\n',
    );
  });

  it('omits an escape-hatch key whose value is undefined', () => {
    const extraFields: JsonObject = { kept: 1 };
    // SAFETY: JsonObject has no undefined in its value type, so the value below cannot be written
    // as a literal. A JavaScript caller can still pass one, and this is what the guard defends.
    Object.defineProperty(extraFields, 'dropped', { value: undefined, enumerable: true });

    expect(emit(mapping(['a'] as const, { a: 1 }, extraFields))).toBe('a: 1\nkept: 1\n');
  });

  it('appends escape-hatch keys after the ordered keys', () => {
    expect(emit(mapping(['a', 'b'] as const, { a: 1, b: 2 }, { z: 26, y: 25 }))).toBe(
      'a: 1\nb: 2\nz: 26\ny: 25\n',
    );
  });

  it('lets an escape-hatch key overwrite an ordered key in place', () => {
    expect(emit(mapping(['a', 'b'] as const, { a: 1, b: 2 }, { a: 99 }))).toBe('a: 99\nb: 2\n');
  });

  it('keeps an integer-like escape-hatch key after the ordered keys', () => {
    expect(emit(mapping(['type'] as const, { type: 'web' }, { '0': 'x' }))).toBe(
      'type: web\n"0": x\n',
    );
  });

  it('emits an empty mapping for an empty order and no escape hatch', () => {
    expect(emit(mapping([], {}, undefined))).toBe('{}\n');
  });
});
