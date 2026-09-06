import { describe, expectTypeOf, it } from 'vitest';

import { postgresReference } from '../references/postgres-reference.js';
import type { EnvGroupEnvironment, EnvironmentMap } from './env-value.js';
import { generated } from './generated.js';
import { literal } from './literal.js';
import { secret } from './secret.js';

const environmentMap = (env: EnvironmentMap): EnvironmentMap => env;

const envGroupEnvironment = (env: EnvGroupEnvironment): EnvGroupEnvironment => env;

describe('EnvironmentMap', () => {
  it('takes a string, a number, the three sentinels, and a database reference', () => {
    expectTypeOf(
      environmentMap({
        NODE_ENV: 'production',
        PORT: 8080,
        LOG_FORMAT: literal('json', { previewValue: 'pretty' }),
        STRIPE_KEY: secret(),
        SESSION_SECRET: generated(),
        DATABASE_URL: postgresReference('elephant', 'blueprint').connectionString,
      }),
    ).toEqualTypeOf<EnvironmentMap>();
  });

  it('rejects a value carrying both a value and a generated marker', () => {
    // @ts-expect-error the three sentinels are disjoint, so no env value carries both.
    environmentMap({ SESSION_SECRET: { sentinel: 'generated', value: 'guessable' } });
  });

  it('rejects a value carrying both a value and a secret marker', () => {
    // @ts-expect-error a secret carries nothing but its sentinel.
    environmentMap({ STRIPE_KEY: { sentinel: 'secret', value: 'sk_live_1' } });
  });

  it('rejects a boolean, which Render has no env var form for', () => {
    // @ts-expect-error spec §6.1 gives value a string or a number.
    environmentMap({ DEBUG: true });
  });
});

describe('EnvGroupEnvironment', () => {
  it('takes a string, a number, a literal, and a generated value', () => {
    expectTypeOf(
      envGroupEnvironment({
        LOG_LEVEL: 'info',
        PORT: 8080,
        LOG_FORMAT: literal('json'),
        SESSION_SECRET: generated(),
      }),
    ).toEqualTypeOf<EnvGroupEnvironment>();
  });

  it('rejects a secret, which Render ignores inside a group', () => {
    // @ts-expect-error spec §6.3 keeps sync: false out of a group.
    envGroupEnvironment({ STRIPE_KEY: secret() });
  });

  it('rejects a database reference, which a group has no form for', () => {
    const url = postgresReference('elephant', 'blueprint').connectionString;

    // @ts-expect-error spec §6.1 gives a group's items the key-value form only.
    envGroupEnvironment({ DATABASE_URL: url });
  });
});
