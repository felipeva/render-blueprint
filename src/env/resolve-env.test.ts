import { describe, expect, it } from 'vitest';

import { postgresReference } from '../references/postgres-reference.js';
import { resolveEnv } from './resolve-env.js';

describe('resolveEnv', () => {
  it('returns one entry per key in declaration order', () => {
    expect(resolveEnv({ SECOND: 'two', FIRST: 1 })).toEqual([
      { form: 'plain', key: 'SECOND', value: 'two' },
      { form: 'plain', key: 'FIRST', value: 1 },
    ]);
  });

  it('returns no entries for an empty map', () => {
    expect(resolveEnv({})).toEqual([]);
  });

  it('marks a database reference with its own form', () => {
    const reference = postgresReference('elephant').connectionString;

    expect(resolveEnv({ DATABASE_URL: reference })).toEqual([
      { form: 'fromDatabase', key: 'DATABASE_URL', reference },
    ]);
  });
});
