import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { missingStartCommand } from './missing-start-command.js';

describe('missingStartCommand', () => {
  it('warns about a native runtime with no start command', () => {
    const warnings = missingStartCommand([web('api', { runtime: 'node' })]);

    expect(warnings).toEqual([
      {
        code: 'MissingStartCommand',
        at: { resource: 'api', field: 'startCommand' },
        message: expect.stringContaining('node'),
      },
    ]);
  });

  it('warns about nothing for a kind Render never starts', () => {
    expect(missingStartCommand([staticSite('marketing', {})])).toEqual([]);
  });

  it('warns about nothing when the start command is set', () => {
    expect(
      missingStartCommand([web('api', { runtime: 'node', startCommand: 'pnpm start' })]),
    ).toEqual([]);
  });

  it('warns about a native worker, private service and cron job alike', () => {
    const warnings = missingStartCommand([
      worker('jobs', { runtime: 'node' }),
      privateService('auth', { runtime: 'go' }),
      cron('nightly', { runtime: 'ruby', schedule: '0 2 * * *' }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['jobs', 'auth', 'nightly']);
  });

  it('warns about nothing on a Docker source, which starts with the dockerCommand', () => {
    expect(
      missingStartCommand([worker('jobs', { runtime: 'docker', dockerCommand: 'node jobs.js' })]),
    ).toEqual([]);
  });

  it('warns about nothing on a prebuilt image, which starts with its own CMD', () => {
    expect(
      missingStartCommand([
        cron('nightly', {
          runtime: 'image',
          schedule: '0 2 * * *',
          image: { url: 'docker.io/acme/report:1' },
        }),
      ]),
    ).toEqual([]);
  });
});
