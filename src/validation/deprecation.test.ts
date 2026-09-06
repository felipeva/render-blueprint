import { describe, expect, it } from 'vitest';

import { deprecation, deprecationScope } from './deprecation.js';

describe('deprecation', () => {
  it('retires previewPlan on a service, where previews.plan replaced it', () => {
    expect(deprecation('previewPlan', 'starter', 'service')).toEqual({
      key: 'previewPlan',
      replacement: 'previews.plan',
    });
  });

  it('keeps previewPlan on a datastore, where it is the current form', () => {
    expect(deprecation('previewPlan', 'basic-1gb', 'datastore')).toBeUndefined();
  });

  it('retires a field Render deprecated everywhere, whatever the scope', () => {
    expect(deprecation('autoDeploy', true, 'datastore')).toEqual({
      key: 'autoDeploy',
      replacement: 'autoDeployTrigger',
    });
  });
});

describe('deprecationScope', () => {
  it('reads a web service and a static site as services', () => {
    expect([deprecationScope('web'), deprecationScope('staticSite')]).toEqual([
      'service',
      'service',
    ]);
  });

  it('reads a Postgres database as a datastore', () => {
    expect(deprecationScope('postgres')).toBe('datastore');
  });
});
