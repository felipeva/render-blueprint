import { describe, expect, it } from 'vitest';

import { literal } from './literal.js';

describe('literal', () => {
  it('returns a value carrying the sentinel and the value it was given', () => {
    expect(literal('info')).toEqual({ sentinel: 'literal', value: 'info' });
  });

  it('omits a preview value it was not given, rather than setting it undefined', () => {
    expect(Object.hasOwn(literal('info'), 'previewValue')).toBe(false);
  });

  it('carries the preview value the options declared', () => {
    expect(literal('info', { previewValue: 'debug' })).toEqual({
      sentinel: 'literal',
      value: 'info',
      previewValue: 'debug',
    });
  });

  it('carries a number as readily as a string', () => {
    expect(literal(8080, { previewValue: 3000 })).toEqual({
      sentinel: 'literal',
      value: 8080,
      previewValue: 3000,
    });
  });
});
