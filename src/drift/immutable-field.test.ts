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
        committed: '"python"',
        generated: '"node"',
      },
    ]);
  });

  it('ignores a field Render can change in place', () => {
    const committed: JsonValue = { services: [{ name: 'api', plan: 'starter' }] };
    const generated: JsonValue = { services: [{ name: 'api', plan: 'standard' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });

  it('reports a field the blueprint newly declares as a change from (absent)', () => {
    const committed: JsonValue = { services: [{ name: 'api' }] };
    const generated: JsonValue = { services: [{ name: 'api', region: 'oregon' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'services',
        resource: 'api',
        field: 'region',
        committed: '(absent)',
        generated: '"oregon"',
      },
    ]);
  });

  it('reports nothing when the blueprint stopped declaring a field', () => {
    const committed: JsonValue = { services: [{ name: 'api', region: 'oregon' }] };
    const generated: JsonValue = { services: [{ name: 'api' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });

  it('quotes a string value so it cannot be read as the number beside it', () => {
    const committed: JsonValue = { databases: [{ name: 'store', postgresMajorVersion: '16' }] };
    const generated: JsonValue = { databases: [{ name: 'store', postgresMajorVersion: 16 }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'databases',
        resource: 'store',
        field: 'postgresMajorVersion',
        committed: '"16"',
        generated: '16',
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

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'databases',
        resource: 'store',
        field: 'user',
        committed: '"app"',
        generated: '"owner"',
      },
      {
        section: 'databases',
        resource: 'store',
        field: 'postgresMajorVersion',
        committed: '16',
        generated: '17',
      },
    ]);
  });

  it('reports one dropped and one added database that otherwise agree as a rename', () => {
    const committed: JsonValue = { databases: [{ name: 'store', databaseName: 'app' }] };
    const generated: JsonValue = { databases: [{ name: 'catalog', databaseName: 'app' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([
      {
        section: 'databases',
        resource: 'catalog',
        field: 'name',
        committed: '"store"',
        generated: '"catalog"',
      },
    ]);
  });

  it('reads a delete plus an add as neither a rename nor a field change', () => {
    const committed: JsonValue = { databases: [{ name: 'store', databaseName: 'app' }] };
    const generated: JsonValue = { databases: [{ name: 'catalog', databaseName: 'catalog' }] };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
  });

  it('refuses to guess a rename when more than one database was dropped or added', () => {
    const committed: JsonValue = {
      databases: [
        { name: 'store', user: 'app' },
        { name: 'ledger', user: 'app' },
      ],
    };
    const generated: JsonValue = {
      databases: [
        { name: 'catalog', user: 'app' },
        { name: 'journal', user: 'app' },
      ],
    };

    expect(immutableFieldChanges(committed, generated)).toEqual([]);
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
