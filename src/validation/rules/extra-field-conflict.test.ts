import { describe, expect, it } from 'vitest';

import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { extraFieldConflict } from './extra-field-conflict.js';

describe('extraFieldConflict', () => {
  it('reports an escape-hatch key the library already emits', () => {
    const issues = extraFieldConflict([
      web('api', { runtime: 'node', extraFields: { name: 'renamed' } }),
    ]);

    expect(issues).toEqual([
      {
        code: 'ExtraFieldConflict',
        at: { resource: 'api', field: 'extraFields.name' },
        message: expect.stringContaining('name'),
      },
    ]);
  });

  it('reports one issue per colliding key', () => {
    const issues = extraFieldConflict([
      web('api', { runtime: 'node', extraFields: { runtime: 'go', envVars: [] } }),
    ]);

    expect(issues.map((issue) => issue.at.field)).toEqual([
      'extraFields.runtime',
      'extraFields.envVars',
    ]);
  });

  it('reports nothing for a modeled key that deprecatedField already claims', () => {
    expect(
      extraFieldConflict([web('api', { runtime: 'node', extraFields: { type: 'redis' } })]),
    ).toEqual([]);
  });

  it('reports nothing for a key the library does not model', () => {
    expect(
      extraFieldConflict([
        web('api', { runtime: 'node', extraFields: { maintenanceWindow: 'sun-03:00' } }),
      ]),
    ).toEqual([]);
  });

  // A sourced kind's emission tuple lists all nine source keys, because one branch or another
  // emits each. Telling the author to set a key through a config that has no such field would be
  // advice they cannot take, so the key names the wrong source instead.
  it('reports a build command beside a Dockerfile as the wrong source', () => {
    const issues = extraFieldConflict([
      worker('jobs', { runtime: 'docker', extraFields: { buildCommand: 'pnpm build' } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(issues[0]?.at).toEqual({ resource: 'jobs', field: 'extraFields.buildCommand' });
    expect(issues[0]?.message).toContain('"docker"');
    expect(issues[0]?.message).not.toContain('extraFields');
  });

  it('reports a Dockerfile path beside a native runtime as the wrong source', () => {
    const issues = extraFieldConflict([
      worker('jobs', { runtime: 'node', extraFields: { dockerfilePath: './Dockerfile' } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(issues[0]?.message).toContain('"node"');
  });

  it('reports a repository beside a prebuilt image as the wrong source', () => {
    const issues = extraFieldConflict([
      privateService('auth', {
        runtime: 'image',
        image: { url: 'docker.io/acme/auth:1' },
        extraFields: { repo: 'https://github.com/acme/auth', branch: 'main', rootDir: 'services' },
      }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual([
      'ConflictingSource',
      'ConflictingSource',
      'ConflictingSource',
    ]);
  });

  it('reports a source key the branch does emit as the conflict it is', () => {
    const issues = extraFieldConflict([
      worker('jobs', { runtime: 'docker', extraFields: { dockerfilePath: './Dockerfile' } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
    expect(issues[0]?.message).toContain('already emits');
  });

  // spec §4.2: a registry credential authorises the base image a Dockerfile build pulls, so the two
  // runtimes that build no Dockerfile name the wrong source. The escape hatch cannot reach past the
  // branch: only a Docker source has the field, and only a Docker source emits the key.
  it('reports a registry credential beside a native runtime as the wrong source', () => {
    const issues = extraFieldConflict([
      web('api', {
        runtime: 'node',
        extraFields: { registryCredential: { fromRegistryCreds: { name: 'acme-dockerhub' } } },
      }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(issues[0]?.at).toEqual({ resource: 'api', field: 'extraFields.registryCredential' });
    expect(issues[0]?.message).toContain('"node"');
    expect(issues[0]?.message).not.toContain('extraFields');
  });

  it('reports a registry credential beside a prebuilt image as the wrong source', () => {
    const issues = extraFieldConflict([
      worker('jobs', {
        runtime: 'image',
        image: { url: 'docker.io/acme/jobs:1' },
        extraFields: { registryCredential: { fromRegistryCreds: { name: 'acme-dockerhub' } } },
      }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(issues[0]?.message).toContain('"image"');
  });

  it('reports a registry credential a Docker source does emit as the conflict it is', () => {
    const issues = extraFieldConflict([
      worker('jobs', {
        runtime: 'docker',
        extraFields: { registryCredential: { fromRegistryCreds: { name: 'acme-dockerhub' } } },
      }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
    expect(issues[0]?.message).toContain('already emits');
  });

  // The allow list is a modeled web and static field now, so the escape hatch would overwrite the
  // key the config emits; on the three kinds that model none of it, webOnlyField still warns.
  it('reports an allow list set through extraFields on a web service', () => {
    const issues = extraFieldConflict([
      web('api', { runtime: 'node', extraFields: { ipAllowList: [{ source: '::1' }] } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
    expect(issues[0]?.at).toEqual({ resource: 'api', field: 'extraFields.ipAllowList' });
  });

  it('reports an allow list set through extraFields on a static site', () => {
    const issues = extraFieldConflict([
      staticSite('marketing', { extraFields: { ipAllowList: [] } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
    expect(issues[0]?.at).toEqual({ resource: 'marketing', field: 'extraFields.ipAllowList' });
  });

  it('reports nothing for an allow list on a worker, which models none of it', () => {
    expect(
      extraFieldConflict([
        worker('jobs', { runtime: 'node', extraFields: { ipAllowList: [{ source: '::1' }] } }),
      ]),
    ).toEqual([]);
  });

  it('reports a source key on a kind that picks no source as the conflict it is', () => {
    const issues = extraFieldConflict([
      staticSite('marketing', { extraFields: { buildCommand: 'pnpm build' } }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
  });
});
