import { describe, expect, it } from 'vitest';

import { deprecation, deprecationAdvice, deprecationScope } from './deprecation.js';

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

  it('retires the singular domain on a service, where the list form replaced it', () => {
    expect(deprecation('domain', 'acme.dev', 'service')).toEqual({
      key: 'domain',
      replacement: 'domains',
    });
  });

  // spec §4.8: only serverService and staticService carry a domain.
  it('retires no domain outside a service, where no kind carries one', () => {
    expect([
      deprecation('domain', 'acme.dev', 'cron'),
      deprecation('domain', 'acme.dev', 'datastore'),
      deprecation('domain', 'acme.dev', 'envGroup'),
    ]).toEqual([undefined, undefined, undefined]);
  });

  it('retires afterFirstDeployCommand, where initialDeployHook replaced it', () => {
    expect([
      deprecation('afterFirstDeployCommand', './seed.sh', 'service'),
      deprecation('afterFirstDeployCommand', './seed.sh', 'cron'),
    ]).toEqual([
      { key: 'afterFirstDeployCommand', replacement: 'initialDeployHook' },
      { key: 'afterFirstDeployCommand', replacement: 'initialDeployHook' },
    ]);
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

  // spec §13: previewPlan is the current form on a datastore.
  it('reads a Key Value instance as a datastore', () => {
    expect(deprecationScope('keyValue')).toBe('datastore');
  });

  it('leaves previewPlan alone on a Key Value instance, where it is the current form', () => {
    expect(deprecation('previewPlan', 'starter', deprecationScope('keyValue'))).toBeUndefined();
  });

  // spec §4.8: cronService carries no previews object and no previewPlan.
  it('reads a cron job as its own scope', () => {
    expect(deprecationScope('cron')).toBe('cron');
  });

  it('names no replacement for a retired preview field on a cron job', () => {
    expect(deprecation('previewPlan', 'starter', 'cron')).toEqual({
      key: 'previewPlan',
      replacement: undefined,
    });
    expect(deprecation('pullRequestPreviewsEnabled', true, 'cron')).toEqual({
      key: 'pullRequestPreviewsEnabled',
      replacement: undefined,
    });
  });

  it('keeps the advice a cron job can take for every other retired field', () => {
    expect(deprecation('env', 'node', 'cron')).toEqual({ key: 'env', replacement: 'runtime' });
    expect(deprecation('autoDeploy', true, 'cron')).toEqual({
      key: 'autoDeploy',
      replacement: 'autoDeployTrigger',
    });
  });
});

describe('deprecationAdvice', () => {
  it('names the replacement a retired field has', () => {
    expect(deprecationAdvice({ key: 'env', replacement: 'runtime' })).toContain('use "runtime"');
  });

  it('names the kinds that carry the hook the retired alias stood for', () => {
    const advice = deprecationAdvice({
      key: 'afterFirstDeployCommand',
      replacement: 'initialDeployHook',
    });

    expect(advice).toContain('a web service, a private service and a background worker');
    expect(advice).toContain('"initialDeployHook"');
  });

  it('says a cron job has no previews when nothing replaces the field', () => {
    expect(deprecationAdvice({ key: 'previewPlan', replacement: undefined })).toContain(
      'no previews of its own',
    );
  });
});
