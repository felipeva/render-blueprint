import { describe, expect, it } from 'vitest';

import { generated } from './generated.js';

describe('generated', () => {
  it('returns a value carrying nothing but the sentinel', () => {
    expect(generated()).toEqual({ sentinel: 'generated' });
  });

  it('returns a fresh value on every call, so two keys never share one object', () => {
    expect(generated()).not.toBe(generated());
  });
});
