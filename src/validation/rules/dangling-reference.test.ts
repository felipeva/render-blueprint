import { describe, expect, it } from 'vitest';

import { postgres } from '../../resources/postgres.js';
import { readReplica } from '../../resources/read-replica.js';
import { web } from '../../resources/web.js';
import { danglingReference } from './dangling-reference.js';

describe('danglingReference', () => {
  it('reports nothing when the referenced database is listed', () => {
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: database.connectionString } });

    expect(danglingReference([api, database])).toEqual([]);
  });

  it('reports nothing when the reference names a listed database read replica', () => {
    const replica = readReplica('elephant-replica');
    const database = postgres('elephant', { readReplicas: [replica] });
    const api = web('api', { runtime: 'node', env: { REPLICA_URL: replica.connectionString } });

    expect(danglingReference([api, database])).toEqual([]);
  });

  it('names the source resource, the env key, and the missing target', () => {
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: database.connectionString } });

    expect(danglingReference([api])).toEqual([
      {
        code: 'DanglingReference',
        at: { resource: 'api', field: 'env.DATABASE_URL' },
        message:
          '"api" reads "DATABASE_URL" from the database "elephant", which this blueprint does not list. Add it to resources, or declare it as a read replica of a database that is listed.',
      },
    ]);
  });

  it('reports a replica that no listed database declares', () => {
    const replica = readReplica('elephant-replica');
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { REPLICA_URL: replica.connectionString } });

    expect(danglingReference([api, database]).map((issue) => issue.at.field)).toEqual([
      'env.REPLICA_URL',
    ]);
  });

  it('reports every dangling reference, never the first only', () => {
    const database = postgres('elephant');
    const api = web('api', {
      runtime: 'node',
      env: { DATABASE_URL: database.connectionString, DATABASE_HOST: database.host },
    });

    expect(danglingReference([api])).toHaveLength(2);
  });

  it('reports nothing for a resource with no environment map', () => {
    expect(danglingReference([postgres('elephant')])).toEqual([]);
  });
});
