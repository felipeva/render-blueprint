import { describe, expect, it } from 'vitest';

import type { JsonValue } from '../json.js';
import { immutableFieldChanges } from './immutable-field.js';

describe('immutableFieldChanges', () => {
  it('names a changed service runtime with both values', () => {
    const committed: JsonValue = { services: [{ name: 'api', type: 'web', runtime: 'python' }] };
    const generated: JsonValue = { services: [{ name: 'api', type: 'web', runtime: 'node' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'services',
        resource: 'api',
        field: 'runtime',
        committed: 'python',
        generated: 'node',
      },
    ]);
  });

  it('ignores a field Render can change in place', () => {
    const committed: JsonValue = { services: [{ name: 'api', plan: 'starter' }] };
    const generated: JsonValue = { services: [{ name: 'api', plan: 'standard' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });

  it('reports a field that appears or disappears as a change against (absent)', () => {
    const committed: JsonValue = { services: [{ name: 'api' }] };
    const generated: JsonValue = { services: [{ name: 'api', region: 'oregon' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'services',
        resource: 'api',
        field: 'region',
        committed: '(absent)',
        generated: 'oregon',
      },
    ]);
  });

  it("names a changed database's user and major version", () => {
    const committed: JsonValue = {
      databases: [{ name: 'store', user: 'app', postgresMajorVersion: 16 }],
    };
    const generated: JsonValue = {
      databases: [{ name: 'store', user: 'owner', postgresMajorVersion: 17 }],
    };

    expect(immutableFieldChanges(committed, generated).map((change) => change.field)).toEqual([
      'user',
      'postgresMajorVersion',
    ]);
  });

  it('reports a renamed database as a change to its name', () => {
    const committed: JsonValue = { databases: [{ name: 'store', databaseName: 'app' }] };
    const generated: JsonValue = { databases: [{ name: 'catalog', databaseName: 'app' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'databases',
        resource: 'catalog',
        field: 'name',
        committed: 'store',
        generated: 'catalog',
      },
    ]);
  });

  it('reports nothing for a service that exists on one side only', () => {
    const committed: JsonValue = { services: [{ name: 'api', runtime: 'node' }] };
    const generated: JsonValue = {
      services: [
        { name: 'api', runtime: 'node' },
        { name: 'worker', runtime: 'python' },
      ],
    };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });

  it('reports nothing when a section is absent or the document is unreadable', () => {
    expect(immutableFieldChanges(undefined, { services: [{ name: 'api' }] })).toEqual([]);
    expect(immutableFieldChanges('not a mapping', { services: [{ name: 'api' }] })).toEqual([]);
    expect(immutableFieldChanges({}, {})).toEqual([]);
  });

  it('reads a resource by name rather than by position', () => {
    const committed: JsonValue = {
      services: [
        { name: 'api', runtime: 'node' },
        { name: 'worker', runtime: 'python' },
      ],
    };
    const generated: JsonValue = {
      services: [
        { name: 'worker', runtime: 'python' },
        { name: 'api', runtime: 'node' },
      ],
    };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });
});
