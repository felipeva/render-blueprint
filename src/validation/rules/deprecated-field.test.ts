import { describe, expect, it } from 'vitest';

import { web } from '../../resources/web.js';
import { deprecatedField } from './deprecated-field.js';

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

  it('reports nothing for a current field', () => {
    expect(
      deprecatedField([web('api', { runtime: 'node', extraFields: { domains: ['acme.dev'] } })]),
    ).toEqual([]);
  });
});
