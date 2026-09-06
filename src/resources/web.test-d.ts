import { describe, expectTypeOf, it } from 'vitest';

import { envGroup } from './env-group.js';
import { postgres } from './postgres.js';
import { web, WEB_CONFIG_SCHEMA_MATCHES_INTERFACE, type WebService } from './web.js';

describe('web', () => {
  it('returns a WebService', () => {
    expectTypeOf(web('api', { runtime: 'node' })).toEqualTypeOf<WebService>();
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a WebConfig field.
    web('api', { runtime: 'node', nope: true });
  });

  it('requires a runtime', () => {
    // @ts-expect-error `runtime` is the one required WebConfig field.
    web('api', {});
  });

  it('rejects a health check path without a leading slash', () => {
    // @ts-expect-error `healthCheckPath` is typed `/${string}`.
    web('api', { runtime: 'node', healthCheckPath: 'healthz' });
  });

  it('rejects a runtime outside the native set', () => {
    // @ts-expect-error `docker` is not a native runtime.
    web('api', { runtime: 'docker' });
  });

  it('takes the environment groups it imports', () => {
    expectTypeOf(
      web('api', { runtime: 'node', envGroups: [envGroup('shared-settings', { env: {} })] }),
    ).toEqualTypeOf<WebService>();
  });

  it('rejects a resource that is not an environment group among the groups it imports', () => {
    // @ts-expect-error only an EnvironmentGroup carries the kind envGroups accepts.
    web('api', { runtime: 'node', envGroups: [postgres('elephant', {})] });
  });

  it('rejects an explicit undefined on an optional field', () => {
    // @ts-expect-error `exactOptionalPropertyTypes` separates omitted from undefined.
    web('api', { runtime: 'node', plan: undefined });
  });
});

describe('web self-reference', () => {
  it('takes the callback form of env, typed to the web service handle', () => {
    web('api', {
      runtime: 'node',
      env: (self) => ({
        APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME'),
        APP_HOSTPORT: self.hostport,
      }),
    });
  });

  it('rejects a variable Render does not provide on the self handle', () => {
    web('api', {
      runtime: 'node',
      env: (self) => ({
        // @ts-expect-error spec §6.6: renderVar takes the closed list, so a typo does not compile.
        APP_HOST: self.renderVar('RENDER_HOSTNAME'),
      }),
    });
  });

  it('rejects a callback returning something other than an environment map', () => {
    // @ts-expect-error the callback answers with the map Render emits as envVars.
    web('api', { runtime: 'node', env: () => 'NODE_ENV=production' });
  });
});

describe('WEB_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(WEB_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
