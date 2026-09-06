import { describe, expectTypeOf, it } from 'vitest';

import {
  privateService,
  PRIVATE_SERVICE_CONFIG_SCHEMA_MATCHES_INTERFACE,
  type PrivateService,
} from './private-service.js';

describe('privateService', () => {
  it('returns a PrivateService', () => {
    expectTypeOf(privateService('auth', { runtime: 'node' })).toEqualTypeOf<PrivateService>();
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a PrivateServiceConfig field.
    privateService('auth', { runtime: 'node', nope: true });
  });

  it('requires a runtime', () => {
    // @ts-expect-error `runtime` is the one required PrivateServiceConfig field.
    privateService('auth', {});
  });

  it('rejects the static runtime, which belongs to a static site', () => {
    // @ts-expect-error spec §3.3: `static` on a private service is structurally legal and meaningless.
    privateService('auth', { runtime: 'static' });
  });

  it('rejects the free plan, which Render offers to web services and static sites', () => {
    // @ts-expect-error spec §8.1: the private service plan table is the serverPlan list without `free`.
    privateService('auth', { runtime: 'node', plan: 'free' });
  });

  it('rejects a health check path, which Render documents for web services', () => {
    // @ts-expect-error spec §16 F: healthCheckPath is web-only prose on a shared schema branch.
    privateService('auth', { runtime: 'node', healthCheckPath: '/healthz' });
  });

  it('answers on the private network, so it carries host, port and hostport', () => {
    const auth = privateService('auth', { runtime: 'node' });

    expectTypeOf(auth.host.name).toEqualTypeOf<string>();
    expectTypeOf(auth.port.name).toEqualTypeOf<string>();
    expectTypeOf(auth.hostport.name).toEqualTypeOf<string>();
  });

  it('takes a prebuilt image without a repository beside it', () => {
    expectTypeOf(
      privateService('auth', { runtime: 'image', image: { url: 'docker.io/acme/auth:1.4.2' } }),
    ).toEqualTypeOf<PrivateService>();
  });

  it('rejects a branch beside a prebuilt image', () => {
    privateService('auth', {
      runtime: 'image',
      image: { url: 'docker.io/acme/auth:1.4.2' },
      // @ts-expect-error spec §4.3: a prebuilt image pins its version in the url, not on a branch.
      branch: 'main',
    });
  });
});

describe('privateService self-reference', () => {
  it('takes the callback form of env, typed to the HTTP handle', () => {
    privateService('auth', {
      runtime: 'node',
      env: (self) => ({ SELF_HOSTPORT: self.hostport }),
    });
  });
});

describe('PRIVATE_SERVICE_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(PRIVATE_SERVICE_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('privateService disks, scaling and previews', () => {
  it('takes a disk, a fixed instance count, a build filter and previews', () => {
    expectTypeOf(
      privateService('auth', {
        runtime: 'node',
        instances: 1,
        disk: { name: 'keys', mountPath: '/var/keys', sizeGB: 5 },
        buildFilter: { ignoredPaths: ['docs/**'] },
        previews: { generation: 'automatic', plan: 'starter' },
        maxShutdownDelaySeconds: 45,
      }),
    ).toEqualTypeOf<PrivateService>();
  });

  it('rejects the free plan on a preview instance, which a private service is not offered', () => {
    // @ts-expect-error spec §8.1: a private service runs on the paid server plans.
    privateService('auth', { runtime: 'node', previews: { plan: 'free' } });
  });

  it('rejects custom domains, which the prose gives to web services', () => {
    // @ts-expect-error spec §16 F: domains sits on the shared branch and the prose restricts it.
    privateService('auth', { runtime: 'node', domains: ['auth.acme.dev'] });
  });
});
