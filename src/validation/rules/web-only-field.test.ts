import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { webOnlyField } from './web-only-field.js';

describe('webOnlyField', () => {
  it('warns about a health check path on a worker', () => {
    const warnings = webOnlyField([
      worker('jobs', { runtime: 'node', extraFields: { healthCheckPath: '/healthz' } }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'WebOnlyField',
        at: { resource: 'jobs', field: 'extraFields.healthCheckPath' },
        message: expect.stringContaining('worker'),
      },
    ]);
  });

  it('warns about every web-only field a private service sets, in spec order', () => {
    const warnings = webOnlyField([
      privateService('auth', {
        runtime: 'node',
        extraFields: {
          ipAllowList: [{ source: '203.0.113.4/30' }],
          domains: ['auth.example.com'],
          maintenanceMode: { enabled: true },
        },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'extraFields.maintenanceMode',
      'extraFields.domains',
      'extraFields.ipAllowList',
    ]);
  });

  it('warns about nothing on the kinds Render documents the fields for', () => {
    expect(
      webOnlyField([web('api', { runtime: 'node', extraFields: { healthCheckPath: '/healthz' } })]),
    ).toEqual([]);
  });

  it('warns about nothing on a cron job, whose schema branch carries none of the fields', () => {
    expect(
      webOnlyField([
        cron('nightly', {
          runtime: 'node',
          schedule: '0 2 * * *',
          extraFields: { healthCheckPath: '/healthz' },
        }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when a worker sets no extra fields', () => {
    expect(webOnlyField([worker('jobs', { runtime: 'node' })])).toEqual([]);
  });
});
