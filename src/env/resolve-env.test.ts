import { describe, expect, it } from 'vitest';

import { postgresReference } from '../references/postgres-reference.js';
import type { DatabaseReferenceValue } from '../references/reference-value.js';
import type { EnvValue } from './env-value.js';
import { resolveEnv } from './resolve-env.js';

// SAFETY: each helper below stands in for a value the CLI loaded through Node type stripping,
// which erases types without checking them, so the annotation is deliberately stronger than the
// value. Zod accepts a null-prototype object as a reference, and rejects a boxed primitive; the
// classifier has to be right about both regardless.
const withoutPrototype: (fields: DatabaseReferenceValue) => DatabaseReferenceValue = (fields) =>
  Object.assign(Object.create(null), fields);

const boxed: (text: string) => EnvValue = (text) => Object(text);

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

  it('reads a reference whose object carries no prototype, which the schema accepts', () => {
    const reference = withoutPrototype({
      reference: 'fromDatabase',
      name: 'elephant',
      property: 'connectionString',
    });

    expect(resolveEnv({ DATABASE_URL: reference })).toEqual([
      { form: 'fromDatabase', key: 'DATABASE_URL', reference },
    ]);
  });

  it('leaves a boxed primitive on the plain branch, because it carries no reference literal', () => {
    const value = boxed('production');

    expect(resolveEnv({ NODE_ENV: value })).toEqual([{ form: 'plain', key: 'NODE_ENV', value }]);
  });
});
