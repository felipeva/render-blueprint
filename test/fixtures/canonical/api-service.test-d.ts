import { describe, expectTypeOf, it } from 'vitest';

import {
  envGroup,
  external,
  keyValue,
  postgres,
  privateService,
  readReplica,
  web,
  withDefaults,
  type DatabaseReferenceValue,
  type ServiceReferenceValue,
  type WebService,
} from '../../../src/index.js';
import { apiService, type ApiDependencies } from './api-service.js';

const factories = withDefaults({ region: 'oregon' });
const replica = readReplica('records-replica');
const db = postgres('records', { readReplicas: [replica] });
const cache = keyValue('cache', { ipAllowList: [] });
const auth = privateService('auth', { runtime: 'node' });
const settings = envGroup('shared-settings', { env: {} });

const deps: ApiDependencies = { factories, db, replica, cache, auth, settings };

describe('ApiDependencies', () => {
  it('yields a typed database reference from the handle the root file passed in', () => {
    expectTypeOf(deps.db.connectionString).toEqualTypeOf<DatabaseReferenceValue>();
    expectTypeOf(deps.replica.connectionString).toEqualTypeOf<DatabaseReferenceValue>();
  });

  it('yields a typed service reference from the handles the root file passed in', () => {
    expectTypeOf(deps.cache.connectionString).toEqualTypeOf<ServiceReferenceValue>();
    expectTypeOf(deps.auth.host).toEqualTypeOf<ServiceReferenceValue>();
  });

  it('rejects a property Render does not publish for a Postgres database', () => {
    // @ts-expect-error spec §6.2: hostport belongs to a service handle, not a database one.
    web('api', { runtime: 'node', env: { DB_HOSTPORT: deps.db.hostport } });
  });

  it('rejects a property Render does not publish for a Key Value instance', () => {
    // @ts-expect-error a KeyValueReference carries connectionString alone.
    web('api', { runtime: 'node', env: { CACHE_HOST: deps.cache.host } });
  });
});

describe('apiService', () => {
  it('returns a web service', () => {
    expectTypeOf(apiService(deps)).toEqualTypeOf<WebService>();
  });

  it('rejects a Key Value instance where the database belongs', () => {
    apiService({
      ...deps,
      // @ts-expect-error a KeyValueStore is not a PostgresDatabase.
      db: cache,
    });
  });

  it('rejects a read replica where the database belongs', () => {
    apiService({
      ...deps,
      // @ts-expect-error a ReadReplica is referenceable but is no listable database.
      db: replica,
    });
  });

  it('rejects an external handle where the private service belongs', () => {
    apiService({
      ...deps,
      // @ts-expect-error an external handle carries no kind, so it is no resource.
      auth: external.privateService('legacy-auth'),
    });
  });

  it('rejects a web service where the private service belongs', () => {
    apiService({
      ...deps,
      // @ts-expect-error a WebService and a PrivateService carry different kinds.
      auth: web('api', { runtime: 'node' }),
    });
  });

  it('rejects a dependency the function does not declare', () => {
    // @ts-expect-error ApiDependencies names every handle the api service reads.
    apiService({ ...deps, queue: cache });
  });
});
