import { describe, expect, it } from 'vitest';

import { generated } from '../../env/generated.js';
import { literal } from '../../env/literal.js';
import { secret } from '../../env/secret.js';
import { web } from '../../resources/web.js';
import { secretSkipsPreviews } from './secret-skips-previews.js';

describe('secretSkipsPreviews', () => {
  it('warns about a secret declared while root previews are on', () => {
    const warnings = secretSkipsPreviews({ generation: 'automatic' }, [
      web('api', { runtime: 'node', env: { STRIPE_KEY: secret() } }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'SecretSkipsPreviews',
        at: { resource: 'api', field: 'env.STRIPE_KEY' },
        message: expect.stringContaining('preview environment'),
      },
    ]);
  });

  it('warns once per secret key', () => {
    const warnings = secretSkipsPreviews({ generation: 'manual' }, [
      web('api', {
        runtime: 'node',
        env: { STRIPE_KEY: secret(), SENTRY_DSN: secret(), NODE_ENV: 'production' },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'env.STRIPE_KEY',
      'env.SENTRY_DSN',
    ]);
  });

  it('warns about nothing when the blueprint declares no root previews', () => {
    expect(
      secretSkipsPreviews(undefined, [web('api', { runtime: 'node', env: { K: secret() } })]),
    ).toEqual([]);
  });

  it('warns about nothing when root preview generation is off', () => {
    expect(
      secretSkipsPreviews({ generation: 'off' }, [
        web('api', { runtime: 'node', env: { K: secret() } }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a value Render does copy into a preview environment', () => {
    expect(
      secretSkipsPreviews({ generation: 'automatic' }, [
        web('api', {
          runtime: 'node',
          env: { LOG_FORMAT: literal('json', { previewValue: 'pretty' }), TOKEN: generated() },
        }),
      ]),
    ).toEqual([]);
  });
});
