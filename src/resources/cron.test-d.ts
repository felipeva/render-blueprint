import { describe, expectTypeOf, it } from 'vitest';

import { external } from '../references/external.js';
import { cron, CRON_CONFIG_SCHEMA_MATCHES_INTERFACE, type CronJob } from './cron.js';
import { web } from './web.js';

describe('cron', () => {
  it('returns a CronJob', () => {
    expectTypeOf(
      cron('nightly', { runtime: 'node', schedule: '0 2 * * *' }),
    ).toEqualTypeOf<CronJob>();
  });

  it('requires a schedule', () => {
    // @ts-expect-error spec §4.1: a cron job runs on a schedule, so the field is required.
    cron('nightly', { runtime: 'node' });
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a CronConfig field.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', nope: true });
  });

  it('rejects a disk, which the published schema does not put on a cron job', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §4.4: cronService carries no disk at all.
      disk: { name: 'data', mountPath: '/var/data' },
    });
  });

  it('rejects the static runtime, which belongs to a static site', () => {
    // @ts-expect-error spec §3.3: `static` on a cron job is structurally legal and meaningless.
    cron('nightly', { runtime: 'static', schedule: '0 2 * * *' });
  });

  it('rejects a plan the cron table does not carry', () => {
    // @ts-expect-error spec §8.1: the cronPlan enum has no `free`.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', plan: 'free' });

    // @ts-expect-error spec §8.1: the cron table tops out at 8c-64g, so no 12c tier is in it.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', plan: '12c-24g' });
  });

  it('rejects the address properties a cron job does not answer on', () => {
    web('api', {
      runtime: 'node',
      // @ts-expect-error spec §6.2: a cron job carries the opaque handle, so `host` is not a member.
      env: { NIGHTLY_HOST: cron('nightly', { runtime: 'node', schedule: '0 2 * * *' }).host },
    });
  });

  it('takes a Dockerfile source', () => {
    expectTypeOf(
      cron('nightly', {
        runtime: 'docker',
        schedule: '0 2 * * *',
        dockerfilePath: './Dockerfile.report',
      }),
    ).toEqualTypeOf<CronJob>();
  });

  it('rejects a root directory beside a prebuilt image', () => {
    cron('nightly', {
      runtime: 'image',
      schedule: '0 2 * * *',
      image: { url: 'docker.io/acme/report:1.0.0' },
      // @ts-expect-error spec §4.3: a prebuilt image names no repository to take a directory in.
      rootDir: './report',
    });
  });
});

describe('cron self-reference', () => {
  it('takes the callback form of env, typed to the opaque handle', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      env: (self) => ({ SELF_NAME: self.renderVar('RENDER_SERVICE_NAME') }),
    });
  });

  it('rejects an address property on the self handle', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §6.2: a cron job answers on no address, so `self.host` is not a member.
      env: (self) => ({ SELF_HOST: self.host }),
    });
  });
});

describe('CRON_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(CRON_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('cron disks, scaling and previews', () => {
  it('takes a build filter, the one field of this set its branch carries', () => {
    expectTypeOf(
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        buildFilter: { paths: ['apps/report/**'] },
      }),
    ).toEqualTypeOf<CronJob>();
  });

  it('rejects a disk', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §4.4: cronService carries no disk.
      disk: { name: 'spool', mountPath: '/var/spool' },
    });
  });

  it('rejects a fixed instance count', () => {
    // @ts-expect-error spec §4.8: numInstances sits on the serverService branch alone.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', instances: 2 });
  });

  it('rejects autoscaling', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §4.5: scaling sits on the serverService branch alone.
      scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
    });
  });

  it('rejects previews of its own', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §4.6: cronService carries no previews object.
      previews: { generation: 'automatic' },
    });
  });

  it('rejects a shutdown delay', () => {
    // @ts-expect-error spec §4.8: maxShutdownDelaySeconds sits on the serverService branch alone.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', maxShutdownDelaySeconds: 30 });
  });
});

describe('cron registry credential', () => {
  it('takes the workspace credential that pulls the private base image a Dockerfile builds on', () => {
    expectTypeOf(
      cron('nightly', {
        runtime: 'docker',
        schedule: '0 2 * * *',
        dockerfilePath: './Dockerfile.report',
        registryCredential: external.registryCredential('acme-dockerhub'),
      }),
    ).toEqualTypeOf<CronJob>();
  });

  it('rejects the credential beside a native runtime, which pulls no base image', () => {
    cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      // @ts-expect-error spec §4.2: registryCredential authorises a Dockerfile build's base image.
      registryCredential: external.registryCredential('acme'),
    });
  });

  it('rejects the credential beside a prebuilt image, which carries image.creds instead', () => {
    cron('nightly', {
      runtime: 'image',
      schedule: '0 2 * * *',
      image: { url: 'docker.io/acme/report:1' },
      // @ts-expect-error spec §4.3: a prebuilt image names its credential through image.creds.
      registryCredential: external.registryCredential('acme'),
    });
  });
});
