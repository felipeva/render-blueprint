import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import {
  postgres,
  POSTGRES_CONFIG_SCHEMA_MATCHES_INTERFACE,
  type PostgresDatabase,
} from './postgres.js';
import { readReplica } from './read-replica.js';
import { web } from './web.js';

describe('postgres', () => {
  it('returns a PostgresDatabase', () => {
    expectTypeOf(postgres('elephant', {})).toEqualTypeOf<PostgresDatabase>();
  });

  it('takes no config, because Render requires only a name', () => {
    expectTypeOf(postgres('elephant')).toEqualTypeOf<PostgresDatabase>();
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a PostgresConfig field.
    postgres('elephant', { nope: true });
  });

  it('rejects a disk size outside the sizes Render accepts', () => {
    // @ts-expect-error `diskSizeGB` is the literal union of 1 and the multiples of 5.
    postgres('elephant', { diskSizeGB: 33 });
  });

  it('rejects a plan from another resource kind', () => {
    // @ts-expect-error `pro ultra` is a server plan, not a Postgres plan.
    postgres('elephant', { plan: 'pro ultra' });
  });

  it('rejects a major version written as a number', () => {
    // @ts-expect-error Render takes the major version as a string.
    postgres('elephant', { postgresMajorVersion: 17 });
  });

  it('rejects an explicit undefined on an optional field', () => {
    // @ts-expect-error `exactOptionalPropertyTypes` separates omitted from undefined.
    postgres('elephant', { plan: undefined });
  });
});

describe('PostgresReference', () => {
  it('rejects a property the handle does not carry', () => {
    // @ts-expect-error `hostport` belongs to a service handle, never a database one.
    web('api', { runtime: 'node', env: { DATABASE_URL: postgres('elephant').hostport } });
  });

  it('rejects a database property Render does not publish', () => {
    // @ts-expect-error `schema` is not one of the seven fromDatabase properties.
    web('api', { runtime: 'node', env: { DATABASE_URL: postgres('elephant').schema } });
  });

  it('accepts every property Render publishes', () => {
    const database = postgres('elephant');

    web('api', {
      runtime: 'node',
      env: {
        DATABASE_URL: database.connectionString,
        POOL_URL: database.connectionPoolString,
        DATABASE_HOST: database.host,
        DATABASE_PORT: database.port,
        DATABASE_USER: database.user,
        DATABASE_PASSWORD: database.password,
        DATABASE_NAME: database.database,
      },
    });
  });
});

describe('POSTGRES_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(POSTGRES_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('blueprint', () => {
  it('takes a database in resources', () => {
    blueprint({ resources: [postgres('elephant')] });
  });

  it('rejects a read replica in resources', () => {
    // @ts-expect-error a ReadReplica is referenceable but is not a BlueprintResource.
    blueprint({ resources: [readReplica('elephant-replica')] });
  });
});

describe('postgres previews', () => {
  it('takes a preview plan and a preview disk size', () => {
    expectTypeOf(
      postgres('elephant', { previews: { plan: 'basic-1gb', diskSizeGB: 5 } }),
    ).toEqualTypeOf<PostgresDatabase>();
  });

  it('rejects a preview disk size that is neither 1 nor a multiple of 5', () => {
    // @ts-expect-error spec §9: a database disk size is 1 GB or a multiple of 5 GB.
    postgres('elephant', { previews: { diskSizeGB: 7 } });
  });
});
