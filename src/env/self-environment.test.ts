import { describe, expect, it } from 'vitest';

import { httpServiceReference } from '../references/http-service-reference.js';
import { selfEnvironment } from './self-environment.js';

const api = httpServiceReference({ name: 'api', type: 'web', origin: 'blueprint' });

describe('selfEnvironment', () => {
  it('returns the map form untouched', () => {
    const env = { NODE_ENV: 'production' };

    expect(selfEnvironment(env, api)).toBe(env);
  });

  it('calls the callback form with the handle it was given', () => {
    expect(selfEnvironment((self) => ({ APP_HOST: self.host }), api)).toEqual({
      APP_HOST: api.host,
    });
  });

  it('returns nothing for a resource that declares no env', () => {
    expect(selfEnvironment(undefined, api)).toBeUndefined();
  });
});
