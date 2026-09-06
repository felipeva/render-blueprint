import { describe, it } from 'vitest';

import { web } from '../resources/web.js';
import { httpServiceReference } from './http-service-reference.js';

const api = httpServiceReference({ name: 'api', type: 'web', origin: 'blueprint' });

describe('HttpServiceReference', () => {
  it('rejects a variable Render does not provide', () => {
    // @ts-expect-error spec §6.6: renderVar takes the closed list, so a typo does not compile.
    api.renderVar('RENDER_EXTERNAL_HOSTNAM');
  });

  it('rejects a property Render does not publish for a service', () => {
    // @ts-expect-error `connectionString` belongs to a database or a Key Value handle.
    web('billing', { runtime: 'node', env: { API_URL: api.connectionString } });
  });

  it('takes any key for envVar, because a service names its own variables', () => {
    web('billing', { runtime: 'node', env: { API_TOKEN: api.envVar('INTERNAL_TOKEN') } });
  });

  it('takes every variable Render provides', () => {
    web('billing', {
      runtime: 'node',
      env: {
        APP_HOST: api.renderVar('RENDER_EXTERNAL_HOSTNAME'),
        APP_URL: api.renderVar('RENDER_EXTERNAL_URL'),
        APP_PORT: api.renderVar('PORT'),
      },
    });
  });
});
