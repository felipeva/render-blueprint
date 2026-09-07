import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { deprecatedField } from './deprecated-field.js';

const SEED = './seed.sh';

describe('deprecatedField', () => {
  it('reports a deprecated Render field smuggled through the escape hatch', () => {
    const issues = deprecatedField([
      web('api', { runtime: 'node', extraFields: { autoDeploy: true } }),
    ]);

    expect(issues).toEqual([
      {
        code: 'DeprecatedField',
        at: { resource: 'api', field: 'extraFields.autoDeploy' },
        message: expect.stringContaining('autoDeployTrigger'),
      },
    ]);
  });

  it('reports every deprecated service field Render replaced', () => {
    const issues = deprecatedField([
      web('api', {
        runtime: 'node',
        extraFields: {
          env: 'node',
          autoDeploy: true,
          previewsEnabled: true,
          pullRequestPreviewsEnabled: true,
          previewPlan: 'starter',
        },
      }),
    ]);

    expect(issues.map((issue) => issue.at.field)).toEqual([
      'extraFields.env',
      'extraFields.autoDeploy',
      'extraFields.previewsEnabled',
      'extraFields.pullRequestPreviewsEnabled',
      'extraFields.previewPlan',
    ]);
  });

  it('reports the retired redis service type', () => {
    const issues = deprecatedField([
      web('api', { runtime: 'node', extraFields: { type: 'redis' } }),
    ]);

    expect(issues).toEqual([
      {
        code: 'DeprecatedField',
        at: { resource: 'api', field: 'extraFields.type' },
        message: expect.stringContaining('keyvalue'),
      },
    ]);
  });

  it('reports the retired afterFirstDeployCommand alias on every sourced kind', () => {
    const issues = deprecatedField([
      web('api', { runtime: 'node', extraFields: { afterFirstDeployCommand: SEED } }),
      privateService('auth', { runtime: 'node', extraFields: { afterFirstDeployCommand: SEED } }),
      worker('jobs', { runtime: 'node', extraFields: { afterFirstDeployCommand: SEED } }),
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        startCommand: './report.sh',
        extraFields: { afterFirstDeployCommand: SEED },
      }),
    ]);

    expect(issues.map((issue) => issue.at)).toEqual([
      { resource: 'api', field: 'extraFields.afterFirstDeployCommand' },
      { resource: 'auth', field: 'extraFields.afterFirstDeployCommand' },
      { resource: 'jobs', field: 'extraFields.afterFirstDeployCommand' },
      { resource: 'nightly', field: 'extraFields.afterFirstDeployCommand' },
    ]);
    expect(issues.map((issue) => issue.code)).toEqual([
      'DeprecatedField',
      'DeprecatedField',
      'DeprecatedField',
      'DeprecatedField',
    ]);
    for (const issue of issues) expect(issue.message).toContain('initialDeployHook');
  });

  it('reports nothing for a current field', () => {
    expect(
      deprecatedField([web('api', { runtime: 'node', extraFields: { domains: ['acme.dev'] } })]),
    ).toEqual([]);
  });
});
