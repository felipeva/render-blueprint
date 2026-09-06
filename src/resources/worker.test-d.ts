import { describe, expectTypeOf, it } from 'vitest';

import { external } from '../references/external.js';
import { web } from './web.js';
import { worker, WORKER_CONFIG_SCHEMA_MATCHES_INTERFACE, type Worker } from './worker.js';

describe('worker', () => {
  it('returns a Worker', () => {
    expectTypeOf(worker('jobs', { runtime: 'node' })).toEqualTypeOf<Worker>();
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a WorkerConfig field.
    worker('jobs', { runtime: 'node', nope: true });
  });

  it('requires a runtime', () => {
    // @ts-expect-error `runtime` is the one required WorkerConfig field.
    worker('jobs', {});
  });

  it('rejects the static runtime, which belongs to a static site', () => {
    // @ts-expect-error spec §3.3: `static` on a worker is structurally legal and meaningless.
    worker('jobs', { runtime: 'static' });
  });

  it('rejects the free plan, which Render offers to web services and static sites', () => {
    // @ts-expect-error spec §8.1: the worker plan table is the serverPlan list without `free`.
    worker('jobs', { runtime: 'node', plan: 'free' });
  });

  it('rejects a health check path, which Render documents for web services', () => {
    // @ts-expect-error spec §16 F: healthCheckPath is web-only prose on a shared schema branch.
    worker('jobs', { runtime: 'node', healthCheckPath: '/healthz' });
  });

  it('rejects the address properties a worker does not answer on', () => {
    web('api', {
      runtime: 'node',
      // @ts-expect-error spec §6.2: a worker carries the opaque handle, so `host` is not a member.
      env: { JOBS_HOST: worker('jobs', { runtime: 'node' }).host },
    });
  });

  it('reads a variable and a Render-provided name off the handle it carries', () => {
    expectTypeOf(worker('jobs', { runtime: 'node' }).envVar('TOKEN').name).toEqualTypeOf<string>();
    expectTypeOf(
      worker('jobs', { runtime: 'node' }).renderVar('RENDER_SERVICE_NAME').name,
    ).toEqualTypeOf<string>();
  });
});

describe('worker source', () => {
  it('takes a Dockerfile and the commands around it', () => {
    expectTypeOf(
      worker('jobs', {
        runtime: 'docker',
        dockerfilePath: './Dockerfile.jobs',
        dockerContext: './',
        dockerCommand: 'node jobs.js',
      }),
    ).toEqualTypeOf<Worker>();
  });

  it('rejects a build command beside a Dockerfile, which is the build', () => {
    // @ts-expect-error spec §4.2: a Docker source builds the Dockerfile, not a buildCommand.
    worker('jobs', { runtime: 'docker', buildCommand: 'pnpm build' });
  });

  it('takes a prebuilt image and the workspace credential that pulls it', () => {
    expectTypeOf(
      worker('jobs', {
        runtime: 'image',
        image: {
          url: 'docker.io/acme/jobs:1.4.2',
          creds: external.registryCredential('acme-dockerhub'),
        },
      }),
    ).toEqualTypeOf<Worker>();
  });

  it('takes the command that overrides the CMD a prebuilt image carries', () => {
    expectTypeOf(
      worker('jobs', {
        runtime: 'image',
        image: { url: 'docker.io/acme/jobs:1.4.2' },
        dockerCommand: 'node jobs.js',
      }),
    ).toEqualTypeOf<Worker>();
  });

  it('requires the url of a prebuilt image', () => {
    // @ts-expect-error spec §4.3: image.url is required once image is present.
    worker('jobs', { runtime: 'image', image: {} });
  });

  it('rejects a repository beside a prebuilt image', () => {
    worker('jobs', {
      runtime: 'image',
      image: { url: 'docker.io/acme/jobs:1.4.2' },
      // @ts-expect-error spec §4.3: image and repo are the two alternative sources.
      repo: 'https://github.com/acme/jobs',
    });
  });

  it('rejects a Dockerfile path beside a native runtime', () => {
    // @ts-expect-error spec §4.2: dockerfilePath belongs to the docker runtime.
    worker('jobs', { runtime: 'node', dockerfilePath: './Dockerfile' });
  });
});

describe('worker self-reference', () => {
  it('takes the callback form of env, typed to the opaque handle', () => {
    worker('jobs', {
      runtime: 'node',
      env: (self) => ({ SELF_NAME: self.renderVar('RENDER_SERVICE_NAME') }),
    });
  });

  it('rejects an address property on the self handle', () => {
    worker('jobs', {
      runtime: 'node',
      // @ts-expect-error spec §6.2: a worker answers on no address, so `self.host` is not a member.
      env: (self) => ({ SELF_HOST: self.host }),
    });
  });
});

describe('WORKER_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(WORKER_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
