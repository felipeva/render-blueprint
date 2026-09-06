import { describe, expectTypeOf, it } from 'vitest';

import { generated } from '../env/generated.js';
import { literal } from '../env/literal.js';
import { secret } from '../env/secret.js';
import { postgresReference } from '../references/postgres-reference.js';
import {
  envGroup,
  ENV_GROUP_CONFIG_SCHEMA_MATCHES_INTERFACE,
  type EnvironmentGroup,
} from './env-group.js';

describe('envGroup', () => {
  it('returns an EnvironmentGroup', () => {
    expectTypeOf(
      envGroup('shared-settings', { env: { LOG_LEVEL: 'info' } }),
    ).toEqualTypeOf<EnvironmentGroup>();
  });

  it('takes a string, a number, a literal, and a generated value', () => {
    expectTypeOf(
      envGroup('shared-settings', {
        env: {
          LOG_LEVEL: 'info',
          PORT: 8080,
          LOG_FORMAT: literal('json', { previewValue: 'pretty' }),
          SESSION_SECRET: generated(),
        },
      }),
    ).toEqualTypeOf<EnvironmentGroup>();
  });

  it('rejects a secret, which Render ignores inside a group', () => {
    // @ts-expect-error spec §6.3 keeps sync: false out of a group.
    envGroup('shared-settings', { env: { STRIPE_KEY: secret() } });
  });

  it('rejects a database reference, which a group has no form for', () => {
    const url = postgresReference('elephant', 'blueprint').connectionString;

    // @ts-expect-error spec §6.1 gives a group's items the key-value form only.
    envGroup('shared-settings', { env: { DATABASE_URL: url } });
  });

  it('rejects a group importing a group, which Render gives no nesting', () => {
    const other = envGroup('regional', { env: { REGION_NAME: 'oregon' } });

    // @ts-expect-error only a service imports a group; EnvGroupConfig has no envGroups field.
    envGroup('shared-settings', { env: {}, envGroups: [other] });
  });

  it('requires an env', () => {
    // @ts-expect-error `env` is the one required EnvGroupConfig field.
    envGroup('shared-settings', {});
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `plan` is not an EnvGroupConfig field.
    envGroup('shared-settings', { env: {}, plan: 'starter' });
  });
});

describe('ENV_GROUP_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(ENV_GROUP_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
