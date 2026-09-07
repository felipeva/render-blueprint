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

  // spec §4.8: cronService lists none of the six and takes no property beyond the ones it lists, so
  // the emitted document is one Render's own schema rejects.
  it('warns about a web-only field on a cron job, whose schema carries none of them', () => {
    const warnings = webOnlyField([
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        extraFields: { domains: ['a.com'], healthCheckPath: '/healthz' },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'extraFields.healthCheckPath',
      'extraFields.domains',
    ]);
    expect(warnings[0]?.message).toContain('cron job');
    expect(warnings[0]?.code).toBe('WebOnlyField');
  });

  // spec §13: the singular domain is also the retired form, so the deprecated-field rule reports
  // an issue on the same key; the issue is the one that blocks and this warning rides beside it.
  it('warns about the singular domain on a worker, beside the issue that retires it', () => {
    const warnings = webOnlyField([
      worker('jobs', { runtime: 'node', extraFields: { domain: 'jobs.example.com' } }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual(['extraFields.domain']);
    expect(warnings[0]?.code).toBe('WebOnlyField');
  });

  // spec §4.8: the matrix row reaches the whole serverService column, so the schema accepts the
  // hook on a private service; the library models it on a web service alone, and says so.
  it('warns about a first-deploy hook on a private service, naming the library for it', () => {
    const warnings = webOnlyField([
      privateService('auth', { runtime: 'node', extraFields: { initialDeployHook: './seed.sh' } }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'WebOnlyField',
        at: { resource: 'auth', field: 'extraFields.initialDeployHook' },
        message: expect.stringContaining('the library models that field on a web service alone'),
      },
    ]);
  });

  // spec §4.8: staticService allows no property beyond the ones it lists, and lists none of these
  // three, so the emitted document is one the published schema rejects.
  it('warns about every field staticService lacks, on a static site', () => {
    const warnings = webOnlyField([
      staticSite('marketing', {
        extraFields: {
          healthCheckPath: '/healthz',
          maintenanceMode: { enabled: true },
          initialDeployHook: './seed.sh',
        },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'extraFields.healthCheckPath',
      'extraFields.maintenanceMode',
      'extraFields.initialDeployHook',
    ]);
    expect(warnings[0]?.code).toBe('WebOnlyField');
    expect(warnings[0]?.message).toContain('static site');
  });

  // The four staticService does carry are the library's own fields there; extraFields setting one
  // is a conflict the extra-field rule reports, not a field out of reach.
  it('warns about nothing a static site carries, however it was set', () => {
    expect(
      webOnlyField([
        staticSite('marketing', {
          extraFields: {
            domains: ['acme.dev'],
            domain: 'acme.dev',
            renderSubdomainPolicy: 'disabled',
            ipAllowList: [{ source: '203.0.113.4/30' }],
          },
        }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when a worker sets no extra fields', () => {
    expect(webOnlyField([worker('jobs', { runtime: 'node' })])).toEqual([]);
  });
});
