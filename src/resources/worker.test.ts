import { describe, expect, it } from 'vitest';

import { worker, type WorkerConfig } from './worker.js';

describe('worker', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: WorkerConfig = { runtime: 'node', buildCommand: 'pnpm build' };
    const service = worker('jobs', config);

    expect(service.kind).toBe('worker');
    expect(service.name).toBe('jobs');
    expect(service.config).toBe(config);
  });

  it('exposes a handle that references its own name', () => {
    expect(worker('jobs', { runtime: 'node' }).envVar('TOKEN')).toEqual({
      reference: 'fromService',
      name: 'jobs',
      origin: 'blueprint',
      type: 'worker',
      envVarKey: 'TOKEN',
    });
  });

  it('aliases a variable Render provides on itself', () => {
    expect(worker('jobs', { runtime: 'node' }).renderVar('RENDER_SERVICE_NAME')).toEqual({
      reference: 'fromService',
      name: 'jobs',
      origin: 'blueprint',
      type: 'worker',
      envVarKey: 'RENDER_SERVICE_NAME',
    });
  });

  it('resolves the callback form of env against its own handle', () => {
    const service = worker('jobs', {
      runtime: 'node',
      env: (self) => ({ SELF_NAME: self.renderVar('RENDER_SERVICE_NAME') }),
    });

    expect(service.config.env).toBeTypeOf('function');
  });

  it('carries a Docker source as the author wrote it', () => {
    const service = worker('jobs', {
      runtime: 'docker',
      dockerfilePath: './Dockerfile.jobs',
      dockerContext: './',
      dockerCommand: 'node jobs.js',
    });

    expect(service.config).toEqual({
      runtime: 'docker',
      dockerfilePath: './Dockerfile.jobs',
      dockerContext: './',
      dockerCommand: 'node jobs.js',
    });
  });
});
