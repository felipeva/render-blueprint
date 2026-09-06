import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import { web } from '../resources/web.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import { validate } from './validate.js';

describe('validate', () => {
  it('accepts a blueprint that trips no rule', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', buildCommand: 'pnpm build', startCommand: 'pnpm start' }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.warnings).toEqual([]);
  });

  it('carries warnings on the accepted blueprint rather than in an error', () => {
    const result = validate(blueprint({ resources: [web('api', { runtime: 'node' })] }));

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'MissingBuildCommand',
      'MissingStartCommand',
    ]);
  });

  it('fails with BlueprintInvalid when a rule reports an issue', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', buildCommand: 'pnpm build' }),
          web('api', { runtime: 'go', buildCommand: 'go build' }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintInvalid.is(result.error)).toBe(true);
    expect(result.error._tag).toBe('BlueprintInvalid');
  });

  it('reports every issue at once, not the first', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', buildCommand: 'pnpm build' }),
          web('api', {
            runtime: 'go',
            buildCommand: 'go build',
            extraFields: { name: 'renamed', autoDeploy: true },
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual([
      'DuplicateResourceName',
      'ExtraFieldConflict',
      'DeprecatedField',
    ]);
  });

  it('names the resource and the field on every issue', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', extraFields: { previewPlan: 'starter' } })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({
      resource: 'api',
      field: 'extraFields.previewPlan',
    });
  });

  it('puts every issue in the error message', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', extraFields: { autoDeploy: true } })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.message).toContain('api.extraFields.autoDeploy');
  });

  it('reports one issue for one mistake when a key is both modeled and deprecated', () => {
    const result = validate(
      blueprint({ resources: [web('api', { runtime: 'node', extraFields: { type: 'redis' } })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DeprecatedField']);
  });

  it('still reports a conflict on a modeled key Render has not retired', () => {
    const result = validate(
      blueprint({ resources: [web('api', { runtime: 'node', extraFields: { type: 'worker' } })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ExtraFieldConflict']);
  });

  it('accepts a blueprint with no resources', () => {
    expect(Result.isOk(validate(blueprint({})))).toBe(true);
  });
});
