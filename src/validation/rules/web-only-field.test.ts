import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
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

  // spec §13: the singular domain is also the retired form.
  it('warns about the singular domain on a worker, beside the issue that retires it', () => {
    const warnings = webOnlyField([
      worker('jobs', { runtime: 'node', extraFields: { domain: 'jobs.example.com' } }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual(['extraFields.domain']);
    expect(warnings[0]?.code).toBe('WebOnlyField');
  });

  // spec §4.8: the matrix row reaches the whole serverService column.
  it('leaves a first-deploy hook on a private service or a worker to the conflict rule', () => {
    expect(
      webOnlyField([
        privateService('auth', {
          runtime: 'node',
          extraFields: { initialDeployHook: './seed.sh' },
        }),
        worker('jobs', { runtime: 'node', extraFields: { initialDeployHook: './seed.sh' } }),
      ]),
    ).toEqual([]);
  });

  // spec §4.8: neither kind shares the serverService definition, so the allow-list rule covers
  // every key this one would name there.
  it('warns about nothing on a cron job or a static site', () => {
    expect(
      webOnlyField([
        cron('nightly', {
          runtime: 'node',
          schedule: '0 2 * * *',
          extraFields: {
            healthCheckPath: '/healthz',
            domains: ['a.com'],
            initialDeployHook: './seed.sh',
          },
        }),
        staticSite('marketing', {
          extraFields: {
            healthCheckPath: '/healthz',
            maintenanceMode: { enabled: true },
            initialDeployHook: './seed.sh',
            renderSubdomainPolicy: 'disabled',
          },
        }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when a worker sets no extra fields', () => {
    expect(webOnlyField([worker('jobs', { runtime: 'node' })])).toEqual([]);
  });
});
