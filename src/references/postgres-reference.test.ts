import { describe, expect, it } from 'vitest';

import { postgresReference } from './postgres-reference.js';

describe('postgresReference', () => {
  it('names the target and the property on every handle property', () => {
    expect(postgresReference('elephant')).toEqual({
      connectionString: {
        reference: 'fromDatabase',
        name: 'elephant',
        property: 'connectionString',
      },
      connectionPoolString: {
        reference: 'fromDatabase',
        name: 'elephant',
        property: 'connectionPoolString',
      },
      host: { reference: 'fromDatabase', name: 'elephant', property: 'host' },
      port: { reference: 'fromDatabase', name: 'elephant', property: 'port' },
      user: { reference: 'fromDatabase', name: 'elephant', property: 'user' },
      password: { reference: 'fromDatabase', name: 'elephant', property: 'password' },
      database: { reference: 'fromDatabase', name: 'elephant', property: 'database' },
    });
  });

  it('carries the name verbatim', () => {
    expect(postgresReference('private database').host.name).toBe('private database');
  });
});
