import { describe, expectTypeOf, it } from 'vitest';

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
    // @ts-expect-error spec §8.1: the cronPlan enum has no `free` and no 12c tier.
    cron('nightly', { runtime: 'node', schedule: '0 2 * * *', plan: 'free' });
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

  it('rejects a repository beside a prebuilt image', () => {
    cron('nightly', {
      runtime: 'image',
      schedule: '0 2 * * *',
      image: { url: 'docker.io/acme/report:1.0.0' },
      // @ts-expect-error spec §4.3: image and repo are the two alternative sources.
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
});

describe('CRON_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(CRON_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
