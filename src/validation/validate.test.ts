import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import type { EnvValue } from '../env/env-value.js';
import { secret } from '../env/secret.js';
import type { JsonObject } from '../json.js';
import { envGroup, type EnvGroupConfig } from '../resources/env-group.js';
import { postgres, type PostgresConfig } from '../resources/postgres.js';
import { readReplica } from '../resources/read-replica.js';
import type { BlueprintResource } from '../resources/resource.js';
import { staticSite, type StaticSiteConfig } from '../resources/static-site.js';
import { web, type WebConfig } from '../resources/web.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import { validate } from './validate.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => WebConfig = JSON.parse;
const uncheckedStatic: (json: string) => StaticSiteConfig = JSON.parse;
const uncheckedDatabase: (json: string) => PostgresConfig = JSON.parse;
const uncheckedEnvValue: (json: string) => EnvValue = JSON.parse;
const uncheckedGroup: (json: string) => EnvGroupConfig = JSON.parse;
const uncheckedName: (json: string) => string = JSON.parse;
const uncheckedResource: (json: string) => BlueprintResource = JSON.parse;

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

  it('reports a field the library does not model on a static site', () => {
    const result = validate(
      blueprint({
        resources: [
          staticSite(
            'marketing',
            uncheckedStatic('{"staticPublishPath":"./dist","plan":"starter"}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'marketing', field: 'plan' });
  });

  it('reports an absolute rootDir on a static site', () => {
    const result = validate(
      blueprint({ resources: [staticSite('marketing', { rootDir: '/apps/marketing' })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['RootDirNotRelative']);
    expect(result.error.issues[0].at).toEqual({ resource: 'marketing', field: 'rootDir' });
  });

  it('reports a route type outside the published pair', () => {
    const result = validate(
      blueprint({
        resources: [
          staticSite(
            'marketing',
            uncheckedStatic('{"routes":[{"type":"proxy","source":"/*","destination":"/"}]}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('routes.0.type');
  });

  it('carries the static site warning on the accepted blueprint', () => {
    const result = validate(
      blueprint({ resources: [staticSite('marketing', { buildCommand: 'pnpm build' })] }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'MissingStaticPublishPath',
    ]);
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
      blueprint({ resources: [web(uncheckedName('{"from":"env"}'), { runtime: 'node' })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at).toEqual({ resource: '[object Object]', field: 'name' });
  });

  it('reports an empty resource name', () => {
    const result = validate(blueprint({ resources: [web('', { runtime: 'node' })] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: '', field: 'name' });
    expect(result.error.issues[0].message).toContain('non-empty');
  });

  it('reports a rootDir that is not relative to the repository root', () => {
    const result = validate(
      blueprint({ resources: [web('api', { runtime: 'node', rootDir: '/apps/api' })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['RootDirNotRelative']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'rootDir' });
    expect(result.error.issues[0].message).toContain('relative to the repository root');
  });

  it('reports extraFields holding a reference back to itself', () => {
    const extraFields: JsonObject = {};
    Object.assign(extraFields, { self: extraFields });

    const result = validate(
      blueprint({ resources: [web('api', { runtime: 'node', extraFields })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['CyclicExtraFields']);
    expect(result.error.issues[0].at.field).toContain('extraFields');
  });

  it('reports an entry in resources that no factory returned', () => {
    const result = validate(blueprint({ resources: [uncheckedResource('null')] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].message).toContain('a factory returned');
  });

  it('reports an entry in resources carrying no modelled kind', () => {
    const result = validate(
      blueprint({ resources: [uncheckedResource('{"name":"api","config":{"runtime":"node"}}')] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'kind' });
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

  it('reports a field the library does not model on a database', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', uncheckedDatabase('{"connectionPool":"none"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'elephant', field: 'connectionPool' });
  });

  it('reports high availability below PostgreSQL 13 under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', {
            postgresMajorVersion: '12',
            highAvailability: { enabled: true },
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['HighAvailabilityUnsupported']);
    expect(result.error.issues[0].at).toEqual({
      resource: 'elephant',
      field: 'highAvailability',
    });
  });

  it('reports a sixth read replica under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', {
            readReplicas: ['a', 'b', 'c', 'd', 'e', 'f'].map(readReplica),
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['TooManyReadReplicas']);
    expect(result.error.issues[0].at).toEqual({ resource: 'elephant', field: 'readReplicas' });
  });

  it('reports a reference to a database the blueprint does not list', () => {
    const elephant = postgres('elephant');
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', env: { DATABASE_URL: elephant.connectionString } }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DanglingReference']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'env.DATABASE_URL' });
  });

  it('accepts a web service wired to a database the blueprint lists', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('elephant-replica')] });
    const replica = readReplica('elephant-replica');

    expect(
      Result.isOk(
        validate(
          blueprint({
            resources: [
              web('api', {
                runtime: 'node',
                env: {
                  DATABASE_URL: elephant.connectionString,
                  REPLICA_URL: replica.connectionString,
                },
              }),
              elephant,
            ],
          }),
        ),
      ),
    ).toBe(true);
  });

  it('keeps previewPlan in a database\u2019s extraFields, where it is the current form', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', { extraFields: { previewPlan: 'basic-1gb' } })],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
  });

  it('still reports previewPlan in a service\u2019s extraFields, where previews.plan replaced it', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', extraFields: { previewPlan: 'starter' } })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DeprecatedField']);
  });

  it('reports a field the library does not model on a read replica', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres(
            'elephant',
            uncheckedDatabase('{"readReplicas":[{"kind":"readReplica","name":"r","oops":1}]}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toContain('UnknownField');
    expect(result.error.issues.map((issue) => issue.at.field)).toContain('readReplicas.0.oops');
  });

  it('reports a field the library does not model on a database reference value', () => {
    const api = web('api', {
      runtime: 'node',
      env: {
        DATABASE_URL: uncheckedEnvValue(
          '{"reference":"fromDatabase","name":"elephant","property":"host","oops":1}',
        ),
      },
    });
    const result = validate(blueprint({ resources: [api, postgres('elephant')] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toContain('env.DATABASE_URL.oops');
  });

  it('reports a field the library does not model on highAvailability', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', uncheckedDatabase('{"highAvailability":{"enabled":true,"oops":1}}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('highAvailability.oops');
  });

  it('reports a field the library does not model on an ipAllowList entry', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', uncheckedDatabase('{"ipAllowList":[{"source":"::1","oops":1}]}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('ipAllowList.0.oops');
  });

  it('reports a field the library does not model on an environment group', () => {
    const result = validate(
      blueprint({
        resources: [envGroup('shared-settings', uncheckedGroup('{"env":{},"plan":"starter"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'shared-settings', field: 'plan' });
  });

  it('reports a secret inside an environment group, which Render ignores there', () => {
    const result = validate(
      blueprint({
        resources: [
          envGroup(
            'shared-settings',
            uncheckedGroup('{"env":{"STRIPE_KEY":{"sentinel":"secret"}}}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at).toEqual({
      resource: 'shared-settings',
      field: 'env.STRIPE_KEY',
    });
  });

  it('reports a database reference inside an environment group', () => {
    const elephant = postgres('elephant', {});
    const result = validate(
      blueprint({
        resources: [
          elephant,
          envGroup(
            'shared-settings',
            uncheckedGroup(
              '{"env":{"DATABASE_URL":{"reference":"fromDatabase","name":"elephant","property":"host"}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('env.DATABASE_URL');
  });

  it('reports a key a service sets directly and imports from a group', () => {
    const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info' } });
    const result = validate(
      blueprint({
        resources: [
          settings,
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            env: { LOG_LEVEL: 'debug' },
            envGroups: [settings],
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['EnvKeyCollision']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'env.LOG_LEVEL' });
  });

  it('reports a key that reaches a service from two imported groups', () => {
    const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info' } });
    const regional = envGroup('regional', { env: { LOG_LEVEL: 'debug' } });
    const result = validate(
      blueprint({
        resources: [
          settings,
          regional,
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            envGroups: [settings, regional],
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DuplicateEnvKey']);
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'env.LOG_LEVEL' });
  });

  it('carries the secret preview warning on an accepted blueprint', () => {
    const result = validate(
      blueprint({
        previews: { generation: 'automatic' },
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            env: { STRIPE_KEY: secret() },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(['SecretSkipsPreviews']);
  });
});
