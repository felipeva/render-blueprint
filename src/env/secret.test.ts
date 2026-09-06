import { describe, expect, it } from 'vitest';

import { secret } from './secret.js';

describe('secret', () => {
  it('returns a value carrying nothing but the sentinel', () => {
    expect(secret()).toEqual({ sentinel: 'secret' });
  });

  it('returns a fresh value on every call, so two keys never share one object', () => {
    expect(secret()).not.toBe(secret());
  });
});
