import { describe, expect, it } from 'vitest';

import { postgresReference } from './postgres-reference.js';

describe('postgresReference', () => {
  it('names the target, the origin and the property on every handle property', () => {
    expect(postgresReference('elephant', 'blueprint')).toEqual({
      connectionString: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'connectionString',
      },
      connectionPoolString: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'connectionPoolString',
      },
      host: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'host',
      },
      port: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'port',
      },
      user: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'user',
      },
      password: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'password',
      },
      database: {
        reference: 'fromDatabase',
        name: 'elephant',
        origin: 'blueprint',
        property: 'database',
      },
    });
  });

  it('carries the name verbatim', () => {
    expect(postgresReference('private database', 'blueprint').host.name).toBe('private database');
  });

  it('carries the origin it was built with', () => {
    expect(postgresReference('legacy', 'external').connectionString.origin).toBe('external');
  });
});
