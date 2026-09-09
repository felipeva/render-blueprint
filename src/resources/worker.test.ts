import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { parseWorkerConfig, worker, type WorkerConfig } from './worker.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => WorkerConfig = JSON.parse;

const raisedIssues: (config: WorkerConfig) => readonly RaisedIssue[] =
  raisedIssuesThrough(parseWorkerConfig);

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

describe('parseWorkerConfig', () => {
  it('reports a disk beside autoscaling when the instance count did not parse', () => {
    expect(
      raisedIssues(
        unchecked(
          '{"runtime":"node","disk":{"name":"state","mountPath":"/var/state"},"scaling":{"minInstances":1,"maxInstances":3,"targetCPUPercent":70},"instances":"three"}',
        ),
      ),
    ).toEqual([{ validationCode: 'DiskPreventsScaling', path: ['scaling'] }]);
  });
});
