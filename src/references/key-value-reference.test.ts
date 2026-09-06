import { describe, expect, it } from 'vitest';

import { keyValueReference } from './key-value-reference.js';

describe('keyValueReference', () => {
  it('reads the connection string through a fromService reference', () => {
    expect(keyValueReference('cache', 'blueprint').connectionString).toEqual({
      reference: 'fromService',
      name: 'cache',
      origin: 'blueprint',
      type: 'keyvalue',
      property: 'connectionString',
    });
  });

  it('carries the name verbatim', () => {
    expect(keyValueReference('shared cache', 'external').connectionString.name).toBe(
      'shared cache',
    );
  });
});
