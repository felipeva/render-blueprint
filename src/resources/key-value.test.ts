import { describe, expect, it } from 'vitest';

import { keyValue, parseKeyValueConfig, type KeyValueConfig } from './key-value.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => KeyValueConfig = JSON.parse;

const issueCodes = (config: KeyValueConfig): readonly string[] => {
  const result = parseKeyValueConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

describe('keyValue', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: KeyValueConfig = { ipAllowList: [] };
    const store = keyValue('cache', config);

    expect(store.kind).toBe('keyValue');
    expect(store.name).toBe('cache');
    expect(store.config).toBe(config);
  });

  it('exposes a handle that references its own name', () => {
    expect(keyValue('cache', { ipAllowList: [] }).connectionString).toEqual({
      reference: 'fromService',
      name: 'cache',
      origin: 'blueprint',
      type: 'keyvalue',
      property: 'connectionString',
    });
  });

  it('emits the name verbatim', () => {
    expect(keyValue('Session Cache', { ipAllowList: [] }).name).toBe('Session Cache');
  });
});

describe('parseKeyValueConfig', () => {
  it('accepts a config that fills every modeled field', () => {
    expect(
      issueCodes({
        ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }, { source: '0.0.0.0/0' }],
        region: 'frankfurt',
        plan: 'starter',
        maxmemoryPolicy: 'volatile-ttl',
        extraFields: { persistenceMode: 'snapshot' },
      }),
    ).toEqual([]);
  });

  it('accepts an empty ipAllowList, which blocks every external connection', () => {
    expect(issueCodes({ ipAllowList: [] })).toEqual([]);
  });

  it('rejects a config with no ipAllowList, the one field Render requires here', () => {
    expect(issueCodes(unchecked('{}'))).toEqual(['invalid_type']);
  });

  it('rejects a field the library does not model', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[],"persistenceMode":"off"}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('rejects a field the library does not model on an ipAllowList entry', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[{"source":"0.0.0.0/0","label":"all"}]}'))).toEqual(
      ['unrecognized_keys'],
    );
  });

  it('rejects a plan from another resource kind', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[],"plan":"pro-8gb"}'))).toEqual(['invalid_value']);
  });

  it('rejects a max memory policy Render does not publish', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[],"maxmemoryPolicy":"allkeys-mru"}'))).toEqual([
      'invalid_value',
    ]);
  });
});
