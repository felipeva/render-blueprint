import { describe, expect, it } from 'vitest';

import { httpServiceReference } from '../references/http-service-reference.js';
import { postgresReference } from '../references/postgres-reference.js';
import type { DatabaseReferenceValue } from '../references/reference-value.js';
import type { EnvValue } from './env-value.js';
import { generated } from './generated.js';
import { literal } from './literal.js';
import { resolveEnv } from './resolve-env.js';
import { secret } from './secret.js';

// SAFETY: each helper below stands in for a value the CLI loaded through Node type stripping,
// which erases types without checking them, so the annotation is deliberately stronger than the
// value. Zod accepts a null-prototype object as a reference, and rejects a boxed primitive; the
// classifier has to be right about both regardless.
const withoutPrototype: (fields: DatabaseReferenceValue) => DatabaseReferenceValue = (fields) =>
  Object.assign(Object.create(null), fields);

const boxed: (text: string) => EnvValue = (text) => Object(text);

describe('resolveEnv', () => {
  it('returns one entry per key in declaration order', () => {
    expect(resolveEnv({ SECOND: 'two', FIRST: 1 }, undefined)).toEqual([
      { form: 'plain', key: 'SECOND', value: 'two' },
      { form: 'plain', key: 'FIRST', value: 1 },
    ]);
  });

  it('returns no entries for an empty map', () => {
    expect(resolveEnv({}, undefined)).toEqual([]);
  });

  it('marks a database reference with its own form', () => {
    const reference = postgresReference('elephant', 'blueprint').connectionString;

    expect(resolveEnv({ DATABASE_URL: reference }, undefined)).toEqual([
      { form: 'fromDatabase', key: 'DATABASE_URL', reference },
    ]);
  });

  it('reads a reference whose object carries no prototype, which the schema accepts', () => {
    const reference = withoutPrototype({
      reference: 'fromDatabase',
      name: 'elephant',
      origin: 'blueprint',
      property: 'connectionString',
    });

    expect(resolveEnv({ DATABASE_URL: reference }, undefined)).toEqual([
      { form: 'fromDatabase', key: 'DATABASE_URL', reference },
    ]);
  });

  it('marks a service reference with its own form', () => {
    const reference = httpServiceReference({
      name: 'api',
      type: 'web',
      origin: 'blueprint',
    }).hostport;

    expect(resolveEnv({ API_HOSTPORT: reference })).toEqual([
      { form: 'fromService', key: 'API_HOSTPORT', reference },
    ]);
  });

  it('marks an aliased environment variable with the service form', () => {
    const reference = httpServiceReference({
      name: 'api',
      type: 'web',
      origin: 'blueprint',
    }).envVar('MINIO_ROOT_PASSWORD');

    expect(resolveEnv({ MINIO_PASSWORD: reference })).toEqual([
      { form: 'fromService', key: 'MINIO_PASSWORD', reference },
    ]);
  });

  it('leaves a boxed primitive on the plain branch, because it carries no reference literal', () => {
    const value = boxed('production');

    expect(resolveEnv({ NODE_ENV: value }, undefined)).toEqual([
      { form: 'plain', key: 'NODE_ENV', value },
    ]);
  });

  it('marks a literal with its own form and carries the preview value it was given', () => {
    expect(
      resolveEnv({ LOG_FORMAT: literal('json', { previewValue: 'pretty' }) }, undefined),
    ).toEqual([{ form: 'literal', key: 'LOG_FORMAT', value: 'json', previewValue: 'pretty' }]);
  });

  it('leaves the preview value of a literal declared without one undefined', () => {
    expect(resolveEnv({ LOG_FORMAT: literal('json') }, undefined)).toEqual([
      { form: 'literal', key: 'LOG_FORMAT', value: 'json', previewValue: undefined },
    ]);
  });

  it('marks a secret with its own form and carries no value', () => {
    expect(resolveEnv({ STRIPE_KEY: secret() }, undefined)).toEqual([
      { form: 'secret', key: 'STRIPE_KEY' },
    ]);
  });

  it('marks a generated value with its own form and carries no value', () => {
    expect(resolveEnv({ SESSION_SECRET: generated() }, undefined)).toEqual([
      { form: 'generated', key: 'SESSION_SECRET' },
    ]);
  });

  it('returns a keyless entry per imported group, after the entries the map declared', () => {
    expect(resolveEnv({ NODE_ENV: 'production' }, ['shared-settings', 'regional'])).toEqual([
      { form: 'plain', key: 'NODE_ENV', value: 'production' },
      { form: 'fromGroup', group: 'shared-settings' },
      { form: 'fromGroup', group: 'regional' },
    ]);
  });

  it('returns only group entries for a resource that declares no map', () => {
    expect(resolveEnv(undefined, ['shared-settings'])).toEqual([
      { form: 'fromGroup', group: 'shared-settings' },
    ]);
  });

  it('returns no entries when neither a map nor a group is declared', () => {
    expect(resolveEnv(undefined, undefined)).toEqual([]);
  });
});
