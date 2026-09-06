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

  it('retires nothing inside an environment group, which has none of the retired fields', () => {
    expect([
      deprecation('env', 'node', 'envGroup'),
      deprecation('autoDeploy', true, 'envGroup'),
      deprecation('previewPlan', 'starter', 'envGroup'),
      deprecation('type', 'redis', 'envGroup'),
    ]).toEqual([undefined, undefined, undefined, undefined]);
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

  it('reads an environment group as its own scope', () => {
    expect(deprecationScope('envGroup')).toBe('envGroup');
  });

  // spec §13: previewPlan is the current form on a datastore, and a Key Value instance is one
  // even though Render lists it under services.
  it('reads a Key Value instance as a datastore', () => {
    expect(deprecationScope('keyValue')).toBe('datastore');
  });

  it('leaves previewPlan alone on a Key Value instance, where it is the current form', () => {
    expect(deprecation('previewPlan', 'starter', deprecationScope('keyValue'))).toBeUndefined();
  });
});
