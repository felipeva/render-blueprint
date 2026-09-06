import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import { web, type WebConfig } from '../resources/web.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import { validate } from './validate.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => WebConfig = JSON.parse;
const uncheckedName: (json: string) => string = JSON.parse;

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

  it('reports a field the library does not model', () => {
    const result = validate(
      blueprint({ resources: [web('api', unchecked('{"runtime":"node","replicas":3}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'replicas' });
  });

  it('reports one issue per unrecognized key', () => {
    const result = validate(
      blueprint({ resources: [web('api', unchecked('{"runtime":"node","replicas":3,"cpu":1}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['replicas', 'cpu']);
  });

  it('reports a runtime outside the native set', () => {
    const result = validate(
      blueprint({ resources: [web('api', unchecked('{"runtime":"deno"}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('runtime');
    expect(result.error.issues[0].message).toContain('node');
  });

  it('reports a health check path without a leading slash', () => {
    const result = validate(
      blueprint({
        resources: [web('api', unchecked('{"runtime":"node","healthCheckPath":"healthz"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at.field).toBe('healthCheckPath');
    expect(result.error.issues[0].message).toContain('"/"');
  });

  it('reports an explicit undefined on an optional field', () => {
    const config = Object.assign(unchecked('{"runtime":"node"}'), { plan: undefined });
    const result = validate(blueprint({ resources: [web('api', config)] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('plan');
  });

  it('accepts a numeric environment variable value', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            env: { PORT: 3000, NODE_ENV: 'production' },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
  });

  it('reports every schema fault in one error', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', unchecked('{"runtime":"deno","healthCheckPath":"healthz","replicas":3}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'runtime',
      'healthCheckPath',
      'replicas',
    ]);
  });

  it('reports schema issues before rule issues', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', unchecked('{"runtime":"node","replicas":3}')),
          web('worker', { runtime: 'go' }),
          web('worker', { runtime: 'node' }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual([
      'UnknownField',
      'DuplicateResourceName',
    ]);
  });

  it('reports rather than throws on a config value no rule function can read', () => {
    const result = validate(
      blueprint({ resources: [web('api', unchecked('{"runtime":"node","env":null}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['env']);
  });

  it('reports a resource name that is not a string', () => {
    const result = validate(
      blueprint({ resources: [web(uncheckedName('42'), { runtime: 'node' })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('name');
  });

  it('reports an empty resource name', () => {
    const result = validate(blueprint({ resources: [web('', { runtime: 'node' })] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at.field).toBe('name');
    expect(result.error.issues[0].message).toContain('non-empty');
  });

  it('reports a duplicate name shared by a valid and a schema-invalid resource', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node' }),
          web('api', unchecked('{"runtime":"node","replicas":3}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual([
      'UnknownField',
      'DuplicateResourceName',
    ]);
  });

  it('accepts a blueprint with no resources', () => {
    expect(Result.isOk(validate(blueprint({})))).toBe(true);
  });
});
