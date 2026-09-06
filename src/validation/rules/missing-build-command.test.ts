import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { missingBuildCommand } from './missing-build-command.js';

describe('missingBuildCommand', () => {
  it('warns about a native runtime with no build command', () => {
    const warnings = missingBuildCommand([web('api', { runtime: 'node' })]);

    expect(warnings).toEqual([
      {
        code: 'MissingBuildCommand',
        at: { resource: 'api', field: 'buildCommand' },
        message: expect.stringContaining('node'),
      },
    ]);
  });

  it('names the static runtime when a static site has no build command', () => {
    const warnings = missingBuildCommand([staticSite('marketing', {})]);

    expect(warnings).toEqual([
      {
        code: 'MissingBuildCommand',
        at: { resource: 'marketing', field: 'buildCommand' },
        message: expect.stringContaining('static'),
      },
    ]);
  });

  it('warns about nothing when the build command is set', () => {
    expect(
      missingBuildCommand([web('api', { runtime: 'node', buildCommand: 'pnpm build' })]),
    ).toEqual([]);
  });

  it('warns about a native worker, private service and cron job alike', () => {
    const warnings = missingBuildCommand([
      worker('jobs', { runtime: 'node' }),
      privateService('auth', { runtime: 'go' }),
      cron('nightly', { runtime: 'ruby', schedule: '0 2 * * *' }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['jobs', 'auth', 'nightly']);
  });

  it('warns about nothing on a Docker source, whose Dockerfile is the build', () => {
    expect(
      missingBuildCommand([worker('jobs', { runtime: 'docker', dockerfilePath: './Dockerfile' })]),
    ).toEqual([]);
  });

  it('warns about nothing on a prebuilt image, which Render does not build', () => {
    expect(
      missingBuildCommand([
        privateService('auth', { runtime: 'image', image: { url: 'docker.io/acme/auth:1' } }),
      ]),
    ).toEqual([]);
  });
});
