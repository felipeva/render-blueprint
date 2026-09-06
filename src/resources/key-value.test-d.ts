import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import {
  keyValue,
  KEY_VALUE_CONFIG_SCHEMA_MATCHES_INTERFACE,
  type KeyValueStore,
} from './key-value.js';
import { web } from './web.js';

describe('keyValue', () => {
  it('returns a KeyValueStore', () => {
    expectTypeOf(keyValue('cache', { ipAllowList: [] })).toEqualTypeOf<KeyValueStore>();
  });

  it('requires the ipAllowList Render requires', () => {
    // @ts-expect-error `ipAllowList` is the one required KeyValueConfig field.
    keyValue('cache', {});
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a KeyValueConfig field.
    keyValue('cache', { ipAllowList: [], nope: true });
  });

  it('rejects a plan from another resource kind', () => {
    // @ts-expect-error `pro-8gb` is a Postgres plan, not a Key Value plan.
    keyValue('cache', { ipAllowList: [], plan: 'pro-8gb' });
  });

  it('rejects a max memory policy Render does not publish', () => {
    // @ts-expect-error `allkeys-mru` is not a member of MaxmemoryPolicy.
    keyValue('cache', { ipAllowList: [], maxmemoryPolicy: 'allkeys-mru' });
  });

  it('rejects an environment map, because Render gives a Key Value instance none', () => {
    // @ts-expect-error spec §5: a Key Value instance carries no envVars.
    keyValue('cache', { ipAllowList: [], env: { NODE_ENV: 'production' } });
  });

  it('rejects an explicit undefined on an optional field', () => {
    // @ts-expect-error `exactOptionalPropertyTypes` separates omitted from undefined.
    keyValue('cache', { ipAllowList: [], plan: undefined });
  });
});

describe('KeyValueReference', () => {
  it('rejects the host property, which Render documents for services alone', () => {
    const cache = keyValue('cache', { ipAllowList: [] });

    // @ts-expect-error spec §6.2: a Key Value handle carries connectionString and nothing else.
    web('api', { runtime: 'node', env: { CACHE_HOST: cache.host } });
  });

  it('rejects reading a variable off a Key Value instance', () => {
    const cache = keyValue('cache', { ipAllowList: [] });

    // @ts-expect-error a Key Value instance has no envVars to alias.
    web('api', { runtime: 'node', env: { CACHE: cache.envVar('PORT') } });
  });

  it('accepts the connection string', () => {
    const cache = keyValue('cache', { ipAllowList: [] });

    web('api', { runtime: 'node', env: { CACHE_URL: cache.connectionString } });
  });
});

describe('KEY_VALUE_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(KEY_VALUE_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('blueprint', () => {
  it('takes a Key Value instance in resources', () => {
    blueprint({ resources: [keyValue('cache', { ipAllowList: [] })] });
  });
});
