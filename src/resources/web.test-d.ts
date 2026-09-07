import { describe, expectTypeOf, it } from 'vitest';

import { external } from '../references/external.js';
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

  it('rejects the static runtime, which belongs to a static site', () => {
    // @ts-expect-error spec §0.2: `runtime: static` narrows type web to a static site instead.
    web('api', { runtime: 'static' });
  });

  it('takes a Dockerfile source', () => {
    expectTypeOf(
      web('api', { runtime: 'docker', dockerfilePath: './Dockerfile', dockerCommand: 'node .' }),
    ).toEqualTypeOf<WebService>();
  });

  it('rejects a build command beside a Dockerfile, which is the build', () => {
    // @ts-expect-error spec §4.2: a Docker source builds the Dockerfile, not a buildCommand.
    web('api', { runtime: 'docker', buildCommand: 'pnpm build' });
  });

  it('rejects a repository beside a prebuilt image', () => {
    web('api', {
      runtime: 'image',
      image: { url: 'docker.io/acme/api:1.4.2' },
      // @ts-expect-error spec §4.3: image and repo are the two alternative sources.
      repo: 'https://github.com/acme/api',
    });
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

describe('web disks, scaling and previews', () => {
  it('takes a disk, a fixed instance count, domains, a build filter and previews', () => {
    expectTypeOf(
      web('api', {
        runtime: 'node',
        instances: 1,
        disk: { name: 'uploads', mountPath: '/var/data', sizeGB: 20 },
        domains: ['acme.dev'],
        buildFilter: { paths: ['apps/api/**'], ignoredPaths: ['**/*.md'] },
        previews: { generation: 'automatic', plan: 'starter', instances: 1 },
        maxShutdownDelaySeconds: 60,
      }),
    ).toEqualTypeOf<WebService>();
  });

  it('takes autoscaling with a target metric', () => {
    expectTypeOf(
      web('api', {
        runtime: 'node',
        scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
      }),
    ).toEqualTypeOf<WebService>();
  });

  it('requires both bounds on scaling, which the prose calls required', () => {
    // @ts-expect-error spec §4.5: minInstances and maxInstances are both required.
    web('api', { runtime: 'node', scaling: { minInstances: 1 } });
  });

  it('rejects a disk with no mount path', () => {
    // @ts-expect-error spec §4.4: a disk carries a name and a mountPath.
    web('api', { runtime: 'node', disk: { name: 'uploads' } });
  });

  it('rejects a preview generation Render does not define', () => {
    // @ts-expect-error spec §4.6: generation is automatic, manual or off.
    web('api', { runtime: 'node', previews: { generation: 'sometimes' } });
  });

  it('rejects a field the schema does not give servicePreviews', () => {
    // @ts-expect-error spec §4.6: servicePreviews carries generation, plan and instances.
    web('api', { runtime: 'node', previews: { expireAfterDays: 7 } });
  });
});

describe('web registry credential', () => {
  it('takes the workspace credential that pulls the private base image a Dockerfile builds on', () => {
    expectTypeOf(
      web('api', {
        runtime: 'docker',
        dockerfilePath: './Dockerfile',
        registryCredential: external.registryCredential('acme-dockerhub'),
      }),
    ).toEqualTypeOf<WebService>();
  });

  it('rejects the credential beside a native runtime, which pulls no base image', () => {
    // @ts-expect-error spec §4.2: registryCredential authorises a Dockerfile build's base image.
    web('api', { runtime: 'node', registryCredential: external.registryCredential('acme') });
  });

  it('rejects the credential beside a prebuilt image, which carries image.creds instead', () => {
    web('api', {
      runtime: 'image',
      image: { url: 'docker.io/acme/api:1' },
      // @ts-expect-error spec §4.3: a prebuilt image names its credential through image.creds.
      registryCredential: external.registryCredential('acme'),
    });
  });
});
