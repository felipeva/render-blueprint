import { describe, expect, it } from 'vitest';

import { external } from '../../references/external.js';
import { envGroup } from '../../resources/env-group.js';
import { web } from '../../resources/web.js';
import { unknownServiceEnvVarKey } from './unknown-service-env-var-key.js';

describe('unknownServiceEnvVarKey', () => {
  it('reports nothing when the target declares the key', () => {
    const auth = web('auth', { runtime: 'node', env: { ROOT_PASSWORD: 'set-in-dashboard' } });
    const api = web('api', { runtime: 'node', env: { PASSWORD: auth.envVar('ROOT_PASSWORD') } });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([]);
  });

  it('warns naming the source resource, the env key, and the key the target does not declare', () => {
    const auth = web('auth', { runtime: 'node', env: { ROOT_PASSWORD: 'set-in-dashboard' } });
    const api = web('api', { runtime: 'node', env: { PASSWORD: auth.envVar('ROOT_PASSWRD') } });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([
      {
        code: 'UnknownServiceEnvVarKey',
        at: { resource: 'api', field: 'env.PASSWORD' },
        message:
          '"api" reads "PASSWORD" from the environment variable "ROOT_PASSWRD" on "auth", which declares no such key. Render keeps variables a blueprint omits, so the key may exist on Render already; declare it on "auth", or reach for the target through an external handle.',
      },
    ]);
  });

  it('accepts a key the target imports from an environment group', () => {
    const shared = envGroup('shared-settings', { env: { ROOT_PASSWORD: 'set-in-dashboard' } });
    const auth = web('auth', { runtime: 'node', envGroups: [shared] });
    const api = web('api', { runtime: 'node', env: { PASSWORD: auth.envVar('ROOT_PASSWORD') } });

    expect(unknownServiceEnvVarKey([api, auth, shared])).toEqual([]);
  });

  it('accepts a variable Render provides, which no service declares itself', () => {
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', {
      runtime: 'node',
      env: { AUTH_HOST: auth.envVar('RENDER_SERVICE_ID') },
    });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([]);
  });

  it('accepts every variable a resource reads off itself through renderVar', () => {
    const api = web('api', {
      runtime: 'node',
      env: (self) => ({ APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME') }),
    });

    expect(unknownServiceEnvVarKey([api])).toEqual([]);
  });

  it('reports a key a service reads off itself and does not declare', () => {
    const api = web('api', {
      runtime: 'node',
      env: (self) => ({ ALIAS: self.envVar('MISSING') }),
    });

    expect(unknownServiceEnvVarKey([api]).map((issue) => issue.at.field)).toEqual(['env.ALIAS']);
  });

  it('reads the keys a callback declares, because the callback is the map', () => {
    const auth = web('auth', {
      runtime: 'node',
      env: (self) => ({ SELF_HOST: self.host, ROOT_PASSWORD: 'set-in-dashboard' }),
    });
    const api = web('api', { runtime: 'node', env: { PASSWORD: auth.envVar('ROOT_PASSWORD') } });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([]);
  });

  it('reports nothing for an external reference whose name a listed resource also takes', () => {
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', {
      runtime: 'node',
      env: { PASSWORD: external.web('auth').envVar('DASHBOARD_ONLY_SECRET') },
    });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([]);
  });

  it('reports nothing for a target outside this blueprint, which danglingReference owns', () => {
    const api = web('api', {
      runtime: 'node',
      env: { PASSWORD: external.privateService('legacy-auth').envVar('ROOT_PASSWORD') },
    });

    expect(unknownServiceEnvVarKey([api])).toEqual([]);
  });

  it('reports nothing for a reference naming a property, which the type already closed', () => {
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', { runtime: 'node', env: { AUTH_HOSTPORT: auth.hostport } });

    expect(unknownServiceEnvVarKey([api, auth])).toEqual([]);
  });

  it('warns for every unknown key, never the first only', () => {
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', {
      runtime: 'node',
      env: { ONE: auth.envVar('NOPE'), TWO: auth.envVar('ALSO_NOPE') },
    });

    expect(unknownServiceEnvVarKey([api, auth])).toHaveLength(2);
  });
});
