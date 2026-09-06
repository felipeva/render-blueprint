import { describe, expect, it } from 'vitest';

import { resolveEnv } from './resolve-env.js';

describe('resolveEnv', () => {
  it('returns one entry per key in declaration order', () => {
    expect(resolveEnv({ SECOND: 'two', FIRST: 1 })).toEqual([
      { key: 'SECOND', value: 'two' },
      { key: 'FIRST', value: 1 },
    ]);
  });

  it('returns no entries for an empty map', () => {
    expect(resolveEnv({})).toEqual([]);
  });
});
