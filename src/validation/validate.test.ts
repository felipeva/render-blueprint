import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import { project } from '../blueprint/project.js';
import { withDefaults } from '../defaults/with-defaults.js';
import type { EnvValue } from '../env/env-value.js';
import { literal } from '../env/literal.js';
import { secret } from '../env/secret.js';
import type { JsonObject } from '../json.js';
import { external } from '../references/external.js';
import { cron, type CronConfig } from '../resources/cron.js';
import { envGroup, type EnvGroupConfig } from '../resources/env-group.js';
import { keyValue, type KeyValueConfig } from '../resources/key-value.js';
import { postgres, type PostgresConfig } from '../resources/postgres.js';
import { privateService, type PrivateServiceConfig } from '../resources/private-service.js';
import { readReplica } from '../resources/read-replica.js';
import type { BlueprintResource } from '../resources/resource.js';
import { staticSite, type StaticSiteConfig } from '../resources/static-site.js';
import { web, type WebConfig } from '../resources/web.js';
import { worker, type WorkerConfig } from '../resources/worker.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import type { ValidationCode } from './issue.js';
import { validate } from './validate.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => WebConfig = JSON.parse;
const uncheckedStatic: (json: string) => StaticSiteConfig = JSON.parse;
const uncheckedDatabase: (json: string) => PostgresConfig = JSON.parse;
const uncheckedKeyValue: (json: string) => KeyValueConfig = JSON.parse;
const uncheckedEnvValue: (json: string) => EnvValue = JSON.parse;
const uncheckedGroup: (json: string) => EnvGroupConfig = JSON.parse;
const uncheckedName: (json: string) => string = JSON.parse;
const uncheckedResource: (json: string) => BlueprintResource = JSON.parse;
const uncheckedWorker: (json: string) => WorkerConfig = JSON.parse;
const uncheckedPrivateService: (json: string) => PrivateServiceConfig = JSON.parse;
const uncheckedCron: (json: string) => CronConfig = JSON.parse;

const CRON_WITH_UNKNOWN_BUILD_FILTER_FIELD =
  '{"runtime":"node","schedule":"0 2 * * *","buildFilter":{"globs":["a"]}}';

const reportedCodes = (result: ReturnType<typeof validate>): readonly ValidationCode[] =>
  Result.isError(result) ? result.error.issues.map((issue) => issue.code) : [];

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

  it('reports a project that declares no environment', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', buildCommand: 'pnpm build', startCommand: 'pnpm start' }),
          web('api', { runtime: 'go', buildCommand: 'go build', startCommand: './api' }),
        ],
        projects: [project('acme', { environments: [] })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintInvalid.is(result.error)).toBe(true);
    expect(result.error.issues).toEqual([
      {
        code: 'ProjectWithoutEnvironment',
        at: { resource: 'acme', field: 'environments' },
        message: expect.stringContaining('Render requires at least one'),
      },
      {
        code: 'DuplicateResourceName',
        at: { resource: 'api', field: 'name' },
        message: expect.stringContaining('api'),
      },
    ]);
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

  it('reports a field the library does not model on a worker', () => {
    const result = validate(
      blueprint({
        resources: [worker('jobs', uncheckedWorker('{"runtime":"node","healthCheckPath":"/x"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'healthCheckPath' });
  });

  it('reports a field the library does not model on a private service', () => {
    const result = validate(
      blueprint({
        resources: [
          privateService('auth', uncheckedPrivateService('{"runtime":"node","domains":["a"]}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'auth', field: 'domains' });
  });

  it('reports a field the library does not model on a cron job', () => {
    const result = validate(
      blueprint({
        resources: [
          cron('nightly', uncheckedCron('{"runtime":"node","schedule":"0 2 * * *","disk":{}}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'nightly', field: 'disk' });
  });

  it('reports a build command beside a Dockerfile as the wrong source', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', uncheckedWorker('{"runtime":"docker","buildCommand":"pnpm build"}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'buildCommand' });
  });

  it('reports a field the library does not model on a Docker source', () => {
    const result = validate(
      blueprint({
        resources: [worker('jobs', uncheckedWorker('{"runtime":"docker","replicas":3}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'replicas' });
  });

  // spec §4.3: image and repo are the two alternative sources, and the published schema enforces
  // no exclusivity between them.
  it('reports a repository beside a prebuilt image as the wrong source', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker('{"runtime":"image","image":{"url":"docker.io/a/b:1"},"repo":"r"}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'repo' });
    expect(result.error.issues[0].message).toContain('"image"');
    expect(result.error.issues[0].message).not.toContain('extraFields');
  });

  it('reports a Dockerfile path beside a native runtime as the wrong source', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', uncheckedWorker('{"runtime":"node","dockerfilePath":"./Dockerfile"}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(result.error.issues[0].message).toContain('"node"');
  });

  // spec §4.2: a registry credential authorises the private base image a Dockerfile build pulls.
  it('reports a registry credential beside a native runtime as the wrong source', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"node","registryCredential":{"fromRegistryCreds":{"name":"acme"}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'registryCredential' });
    expect(result.error.issues[0].message).toContain('"node"');
  });

  it('reports a registry credential beside a prebuilt image as the wrong source', () => {
    const result = validate(
      blueprint({
        resources: [
          cron(
            'nightly',
            uncheckedCron(
              '{"runtime":"image","schedule":"0 2 * * *","image":{"url":"docker.io/a/b:1"},"registryCredential":{"fromRegistryCreds":{"name":"acme"}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['ConflictingSource']);
    expect(result.error.issues[0].at).toEqual({ resource: 'nightly', field: 'registryCredential' });
    expect(result.error.issues[0].message).toContain('"image"');
    expect(result.error.issues[0].message).not.toContain('extraFields');
  });

  it('reports a field the credential a Docker source carries does not define', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"docker","registryCredential":{"fromRegistryCreds":{"name":"acme","id":1}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('registryCredential.fromRegistryCreds.id');
  });

  it('reports an empty credential name on a Docker source', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"docker","registryCredential":{"fromRegistryCreds":{"name":""}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('registryCredential.fromRegistryCreds.name');
  });

  it('reports an empty credential name on the image a prebuilt source pulls', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"image","image":{"url":"docker.io/a/b:1","creds":{"fromRegistryCreds":{"name":""}}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('image.creds.fromRegistryCreds.name');
  });

  it('reports a field beside fromRegistryCreds, which is the whole of a credential', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"docker","registryCredential":{"fromRegistryCreds":{"name":"acme"},"nope":1}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('registryCredential.nope');
  });

  it('reports a source key on a kind that picks no source as an unknown field', () => {
    const result = validate(
      blueprint({
        resources: [staticSite('marketing', uncheckedStatic('{"dockerfilePath":"./Dockerfile"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
  });

  it('reports a source key nested inside a prebuilt image as an unknown field', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', uncheckedWorker('{"runtime":"image","image":{"url":"u","repo":"r"}}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('image.repo');
  });

  it('reports a field the library does not model on a prebuilt image', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', uncheckedWorker('{"runtime":"image","image":{"url":"u","sha":"abc"}}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('image.sha');
  });

  it('reports a field the library does not model on a registry credential', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"image","image":{"url":"u","creds":{"fromRegistryCreds":{"name":"n","id":1}}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('image.creds.fromRegistryCreds.id');
  });

  it('reports a runtime that picks no source the library models', () => {
    const result = validate(
      blueprint({ resources: [worker('jobs', uncheckedWorker('{"runtime":"static"}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'runtime' });
  });

  it('reports a cron job with no schedule', () => {
    const result = validate(
      blueprint({ resources: [cron('nightly', uncheckedCron('{"runtime":"node"}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at).toEqual({ resource: 'nightly', field: 'schedule' });
  });

  it('warns about a web-only field a worker sets through extraFields', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', {
            runtime: 'docker',
            dockerCommand: 'node jobs.js',
            extraFields: { healthCheckPath: '/healthz' },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(['WebOnlyField']);
  });

  // ADR-0003: the identity guard cannot see strictness.
  it('reports a field the library does not model on each source branch of a web service', () => {
    const results = [
      '{"runtime":"node","nope":1}',
      '{"runtime":"docker","nope":1}',
      '{"runtime":"image","image":{"url":"u"},"nope":1}',
    ].map((json) => validate(blueprint({ resources: [web('api', unchecked(json))] })));

    expect(results.map(reportedCodes)).toEqual([
      ['UnknownField'],
      ['UnknownField'],
      ['UnknownField'],
    ]);
  });

  it('reports a field the library does not model on each source branch of a worker', () => {
    const results = [
      '{"runtime":"node","nope":1}',
      '{"runtime":"docker","nope":1}',
      '{"runtime":"image","image":{"url":"u"},"nope":1}',
    ].map((json) => validate(blueprint({ resources: [worker('jobs', uncheckedWorker(json))] })));

    expect(results.map(reportedCodes)).toEqual([
      ['UnknownField'],
      ['UnknownField'],
      ['UnknownField'],
    ]);
  });

  it('reports a field the library does not model on each source branch of a private service', () => {
    const results = [
      '{"runtime":"node","nope":1}',
      '{"runtime":"docker","nope":1}',
      '{"runtime":"image","image":{"url":"u"},"nope":1}',
    ].map((json) =>
      validate(blueprint({ resources: [privateService('auth', uncheckedPrivateService(json))] })),
    );

    expect(results.map(reportedCodes)).toEqual([
      ['UnknownField'],
      ['UnknownField'],
      ['UnknownField'],
    ]);
  });

  it('reports a field the library does not model on each source branch of a cron job', () => {
    const results = [
      '{"runtime":"node","schedule":"0 2 * * *","nope":1}',
      '{"runtime":"docker","schedule":"0 2 * * *","nope":1}',
      '{"runtime":"image","schedule":"0 2 * * *","image":{"url":"u"},"nope":1}',
    ].map((json) => validate(blueprint({ resources: [cron('nightly', uncheckedCron(json))] })));

    expect(results.map(reportedCodes)).toEqual([
      ['UnknownField'],
      ['UnknownField'],
      ['UnknownField'],
    ]);
  });

  it('reports a prebuilt image whose url is empty', () => {
    const result = validate(
      blueprint({
        resources: [worker('jobs', { runtime: 'image', image: { url: '' } })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['InvalidConfig']);
    expect(result.error.issues[0].at.field).toBe('image.url');
  });

  it('reports a field the library does not model beside a registry credential', () => {
    const result = validate(
      blueprint({
        resources: [
          worker(
            'jobs',
            uncheckedWorker(
              '{"runtime":"image","image":{"url":"u","creds":{"fromRegistryCreds":{"name":"n"},"nope":1}}}',
            ),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at.field).toBe('image.creds.nope');
  });

  it('reports a field the library does not model on a Key Value instance', () => {
    const result = validate(
      blueprint({
        resources: [keyValue('cache', uncheckedKeyValue('{"ipAllowList":[],"runtime":"node"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({ resource: 'cache', field: 'runtime' });
  });

  // spec §6.4: Render keeps a variable the blueprint omits, so the key may be there already.
  it('warns, rather than fails, on a key the referenced service does not declare', () => {
    const auth = web('auth', { runtime: 'node', buildCommand: 'x', startCommand: 'y' });
    const api = web('api', {
      runtime: 'node',
      buildCommand: 'x',
      startCommand: 'y',
      env: { PASSWORD: auth.envVar('ROOT_PASSWORD') },
    });
    const result = validate(blueprint({ resources: [api, auth] }));

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'UnknownServiceEnvVarKey',
    ]);
    expect(result.value.warnings[0]?.at).toEqual({ resource: 'api', field: 'env.PASSWORD' });
  });

  it('silences that warning when the reference is an external handle', () => {
    const auth = web('auth', { runtime: 'node', buildCommand: 'x', startCommand: 'y' });
    const api = web('api', {
      runtime: 'node',
      buildCommand: 'x',
      startCommand: 'y',
      env: { PASSWORD: external.web('auth').envVar('ROOT_PASSWORD') },
    });
    const result = validate(blueprint({ resources: [api, auth] }));

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('accepts a blueprint whose services reference each other and themselves', () => {
    const cache = keyValue('cache', { ipAllowList: [] });
    const auth = web('auth', {
      runtime: 'node',
      buildCommand: 'x',
      startCommand: 'y',
      env: { ROOT_PASSWORD: 'set-in-dashboard' },
    });
    const api = web('api', {
      runtime: 'node',
      buildCommand: 'x',
      startCommand: 'y',
      env: (self) => ({
        APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME'),
        AUTH_HOSTPORT: auth.hostport,
        AUTH_PASSWORD: auth.envVar('ROOT_PASSWORD'),
        CACHE_URL: cache.connectionString,
      }),
    });

    expect(Result.isOk(validate(blueprint({ resources: [api, auth, cache] })))).toBe(true);
  });

  it('reports the failing key inside an env a callback returned', () => {
    const api = web('api', {
      runtime: 'node',
      buildCommand: 'x',
      startCommand: 'y',
      env: () => ({ CACHE_URL: uncheckedEnvValue('{"reference":"fromService"}') }),
    });
    const result = validate(blueprint({ resources: [api] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'env.CACHE_URL' });
  });

  it('reports a bad env value beside the field that failed in the same config', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked('{"runtime":"node","plan":"nope","env":{"CACHE_URL":{"reference":"x"}}}'),
          ),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['plan', 'env.CACHE_URL']);
  });

  it('defers the env issues of a callback until the rest of the config parses', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            ...unchecked('{"plan":"nope"}'),
            runtime: 'node',
            env: () => ({ CACHE_URL: uncheckedEnvValue('{"reference":"x"}') }),
          }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['plan']);
  });

  it('reports an env that is neither a map nor a callback', () => {
    const result = validate(
      blueprint({ resources: [web('api', unchecked('{"runtime":"node","env":42}'))] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at)).toEqual([
      { resource: 'api', field: 'env' },
    ]);
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
          web('api', unchecked('{"runtime":"node","healthCheckPath":"healthz","replicas":3}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'healthCheckPath',
      'replicas',
    ]);
  });

  // spec §3.2: runtime picks the source.
  it('reports the runtime alone when it matches no source the library models', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', unchecked('{"runtime":"deno","healthCheckPath":"healthz","replicas":3}')),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['runtime']);
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

  it('keeps an entry no factory returned out of the rules that read names', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node' }),
          uncheckedResource('{"name":"api","config":{"runtime":"node"}}'),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig']);
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
        resources: [postgres('elephant', uncheckedDatabase('{"maintenanceWindow":"sun-03:00"}'))],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['UnknownField']);
    expect(result.error.issues[0].at).toEqual({
      resource: 'elephant',
      field: 'maintenanceWindow',
    });
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

  it('reports a disk size that is neither 1 nor a multiple of 5 under its own code', () => {
    const result = validate(blueprint({ resources: [postgres('elephant', { diskSizeGB: 7 })] }));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DiskSizeDisallowed']);
    expect(result.error.issues[0].at).toEqual({ resource: 'elephant', field: 'diskSizeGB' });
  });

  it('reports a preview disk size that breaks the same rule at its own field path', () => {
    const result = validate(
      blueprint({ resources: [postgres('elephant', { previews: { diskSizeGB: 7 } })] }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['DiskSizeDisallowed']);
    expect(result.error.issues[0].at).toEqual({
      resource: 'elephant',
      field: 'previews.diskSizeGB',
    });
  });

  it('reports the disk-size rule beside a region Render does not publish', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', uncheckedDatabase('{"region":"dublin","diskSizeGB":7}'))],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'DiskSizeDisallowed']);
  });

  it('reports high availability on a plan with less than one CPU under its own code', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', { plan: '0.5c-1g', highAvailability: { enabled: true } })],
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

  it('reports high availability on a plan a defaults scope filled in', () => {
    const acme = withDefaults({ plan: { postgres: 'free' } });
    const result = validate(
      blueprint({
        resources: [acme.postgres('elephant', { highAvailability: { enabled: true } })],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues).toEqual([
      {
        code: 'HighAvailabilityUnsupported',
        at: { resource: 'elephant', field: 'highAvailability' },
        message:
          'High availability needs a compute plan with at least 1 CPU, and this database asks for the "free" plan. "elephant" takes "plan" from a defaults scope, so the value to change is the scope\'s.',
      },
    ]);
  });

  it('names no defaults scope when the database sets its own plan', () => {
    const acme = withDefaults({ region: 'frankfurt', plan: { postgres: 'pro-4gb' } });
    const result = validate(
      blueprint({
        resources: [
          acme.postgres('elephant', { plan: 'free', highAvailability: { enabled: true } }),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues).toEqual([
      {
        code: 'HighAvailabilityUnsupported',
        at: { resource: 'elephant', field: 'highAvailability' },
        message:
          'High availability needs a compute plan with at least 1 CPU, and this database asks for the "free" plan.',
      },
    ]);
  });

  it('reports both high-availability rules from one database', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', {
            plan: '0.5c-1g',
            postgresMajorVersion: '12',
            highAvailability: { enabled: true },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual([
      'HighAvailabilityUnsupported',
      'HighAvailabilityUnsupported',
    ]);
  });

  it('reports the version rule beside a plan whose value did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres(
            'elephant',
            uncheckedDatabase(
              '{"plan":"gigantic","postgresMajorVersion":"12","highAvailability":{"enabled":true}}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'HighAvailabilityUnsupported']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'plan',
      'highAvailability',
    ]);
  });

  it('reports the plan rule beside a version whose value did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres(
            'elephant',
            uncheckedDatabase(
              '{"plan":"0.5c-1g","postgresMajorVersion":12,"highAvailability":{"enabled":true}}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'HighAvailabilityUnsupported']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'postgresMajorVersion',
      'highAvailability',
    ]);
  });

  it('reports a bad disk size and the high-availability rule from one database', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres('elephant', {
            postgresMajorVersion: '12',
            diskSizeGB: 7,
            highAvailability: { enabled: true },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['DiskSizeDisallowed', 'HighAvailabilityUnsupported']);
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

  it('reports an inverted scaling range under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            scaling: { minInstances: 4, maxInstances: 2, targetCPUPercent: 70 },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ScalingRangeInverted']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'scaling.maxInstances' });
  });

  it('reports autoscaling with no target metric under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm work',
            scaling: { minInstances: 1, maxInstances: 4 },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ScalingTargetMissing']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'jobs', field: 'scaling' });
  });

  it('reports a disk beside autoscaling under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          privateService('auth', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm serve',
            disk: { name: 'keys', mountPath: '/var/keys' },
            scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['DiskPreventsScaling']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'auth', field: 'scaling' });
  });

  it('reports a disk on a path Render reserves under its own code', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            disk: { name: 'uploads', mountPath: '/etc' },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['MountPathDisallowed']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'disk.mountPath' });
  });

  it('reports every cross-field rule beside a field whose value did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"node","healthCheckPath":"healthz","renderSubdomainPolicy":"disabled","disk":{"name":"uploads","mountPath":"/var/data"},"instances":3}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual([
      'InvalidConfig',
      'DiskPreventsScaling',
      'SubdomainPolicyNeedsDomain',
    ]);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'healthCheckPath',
      'instances',
      'renderSubdomainPolicy',
    ]);
  });

  it('reports the high-availability rule beside a region whose value did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          postgres(
            'elephant',
            uncheckedDatabase(
              '{"region":"mars","postgresMajorVersion":"12","highAvailability":{"enabled":true}}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'HighAvailabilityUnsupported']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'region',
      'highAvailability',
    ]);
  });

  it('reports a disk beside more than one instance when scaling did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"node","disk":{"name":"uploads","mountPath":"/var/data"},"scaling":"nope","instances":3}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'DiskPreventsScaling']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['scaling', 'instances']);
  });

  it('reports a disk beside autoscaling when the instance count did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"node","disk":{"name":"uploads","mountPath":"/var/data"},"scaling":{"minInstances":1,"maxInstances":3,"targetCPUPercent":70},"instances":"three"}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig', 'DiskPreventsScaling']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual(['instances', 'scaling']);
  });

  it('reports nothing from the disk rule when the instance count it reads did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"node","disk":{"name":"uploads","mountPath":"/var/data"},"instances":"three"}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'instances' });
  });

  it('reports both cross-field rules beside a key the library does not model', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"node","zone":"iad","renderSubdomainPolicy":"disabled","disk":{"name":"uploads","mountPath":"/var/data"},"instances":3}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual([
      'UnknownField',
      'DiskPreventsScaling',
      'SubdomainPolicyNeedsDomain',
    ]);
  });

  it('reports the subdomain rule beside a mount path Render reserves', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            disk: { name: 'uploads', mountPath: '/etc' },
            renderSubdomainPolicy: 'disabled',
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['MountPathDisallowed', 'SubdomainPolicyNeedsDomain']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues.map((issue) => issue.at.field)).toEqual([
      'disk.mountPath',
      'renderSubdomainPolicy',
    ]);
  });

  it('reports nothing from the branch rules when the source runtime did not parse', () => {
    const result = validate(
      blueprint({
        resources: [
          web(
            'api',
            unchecked(
              '{"runtime":"mars","renderSubdomainPolicy":"disabled","disk":{"name":"uploads","mountPath":"/var/data"},"instances":3}',
            ),
          ),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['InvalidConfig']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'runtime' });
  });

  it('reports a scaling target above 90 as out of range', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 95 },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['OutOfRange']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({
      resource: 'api',
      field: 'scaling.targetCPUPercent',
    });
  });

  it('warns that autoscaling makes Render ignore the instance count', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            instances: 3,
            scaling: { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'InstancesIgnoredByScaling',
    ]);
  });

  it('warns about a build filter on every kind an image can source', () => {
    const image = { url: 'docker.io/acme/api:1.0.0' };
    const buildFilter = { paths: ['src/**'] };
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'image', image, buildFilter }),
          privateService('auth', { runtime: 'image', image, buildFilter }),
          worker('jobs', { runtime: 'image', image, buildFilter }),
          cron('nightly', { runtime: 'image', image, schedule: '0 2 * * *', buildFilter }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'BuildFilterOnImageSource',
      'BuildFilterOnImageSource',
      'BuildFilterOnImageSource',
      'BuildFilterOnImageSource',
    ]);
    expect(result.value.warnings.map((warning) => warning.at)).toEqual([
      { resource: 'api', field: 'buildFilter' },
      { resource: 'auth', field: 'buildFilter' },
      { resource: 'jobs', field: 'buildFilter' },
      { resource: 'nightly', field: 'buildFilter' },
    ]);
  });

  it('warns about nothing for a build filter on a repository source or an image without one', () => {
    const buildFilter = { paths: ['src/**'] };
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            buildFilter,
          }),
          worker('jobs', { runtime: 'docker', buildFilter }),
          privateService('auth', {
            runtime: 'image',
            image: { url: 'docker.io/acme/auth:1.0.0' },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('reports a field the library does not model inside a disk', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', unchecked('{"runtime":"node","disk":{"name":"d","mountPath":"/d","size":1}}')),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['UnknownField']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'disk.size' });
  });

  it('reports a field the library does not model inside a build filter', () => {
    const result = validate(
      blueprint({
        resources: [cron('nightly', uncheckedCron(CRON_WITH_UNKNOWN_BUILD_FILTER_FIELD))],
      }),
    );

    expect(reportedCodes(result)).toEqual(['UnknownField']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'nightly', field: 'buildFilter.globs' });
  });

  it('reports a field the library does not model inside a static site\u2019s previews', () => {
    const result = validate(
      blueprint({
        resources: [staticSite('marketing', uncheckedStatic('{"previews":{"plan":"starter"}}'))],
      }),
    );

    expect(reportedCodes(result)).toEqual(['UnknownField']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'marketing', field: 'previews.plan' });
  });

  it('reports a field the library does not model inside a Key Value preview override', () => {
    const result = validate(
      blueprint({
        resources: [
          keyValue('cache', uncheckedKeyValue('{"ipAllowList":[],"previews":{"diskSizeGB":5}}')),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['UnknownField']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'cache', field: 'previews.diskSizeGB' });
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

  it('reports previewPlan in a database\u2019s extraFields as a conflict, not a retired form', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', { extraFields: { previewPlan: 'basic-1gb' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports connectionPool in a database\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', { extraFields: { connectionPool: 'pgbouncer' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports storageAutoscalingEnabled in a database\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [postgres('elephant', { extraFields: { storageAutoscalingEnabled: true } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
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
          '{"reference":"fromDatabase","name":"elephant","origin":"blueprint","property":"host","oops":1}',
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
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'envGroups' });
  });

  it('accepts a web service carrying the hook, maintenance mode and the policy', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            initialDeployHook: './seed_database.sh',
            maintenanceMode: { enabled: true, uri: 'https://status.acme.dev/maintenance' },
            domains: ['acme.dev'],
            renderSubdomainPolicy: 'disabled',
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('accepts a private service and a worker carrying the hook', () => {
    const result = validate(
      blueprint({
        resources: [
          privateService('auth', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            initialDeployHook: './seed.sh',
          }),
          worker('jobs', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm jobs',
            initialDeployHook: './seed.sh',
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('reports a relative maintenance uri on the nested field', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', maintenanceMode: { uri: '/maintenance' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['MaintenanceUriNotAbsolute']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'maintenanceMode.uri' });
  });

  it('reports a disabled subdomain policy on a web service that lists no domain', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', renderSubdomainPolicy: 'disabled' })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['SubdomainPolicyNeedsDomain']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({
      resource: 'api',
      field: 'renderSubdomainPolicy',
    });
  });

  it('reports a disabled subdomain policy on a static site that lists no domain', () => {
    const result = validate(
      blueprint({
        resources: [staticSite('marketing', { renderSubdomainPolicy: 'disabled' })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['SubdomainPolicyNeedsDomain']);
  });

  it('reports the first-deploy hook in a web service\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', extraFields: { initialDeployHook: './seed.sh' } }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports the first-deploy hook in a private service\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [
          privateService('auth', {
            runtime: 'node',
            extraFields: { initialDeployHook: './seed.sh' },
          }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports the first-deploy hook in a worker\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', { runtime: 'node', extraFields: { initialDeployHook: './seed.sh' } }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports maintenance mode in a web service\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', extraFields: { maintenanceMode: { enabled: true } } }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports the subdomain policy in a web service\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'node', extraFields: { renderSubdomainPolicy: 'disabled' } }),
        ],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports the subdomain policy in a static site\u2019s extraFields as a conflict', () => {
    const result = validate(
      blueprint({
        resources: [staticSite('marketing', { extraFields: { renderSubdomainPolicy: 'enabled' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
  });

  it('reports the singular domain in a web service\u2019s extraFields as a retired form', () => {
    const result = validate(
      blueprint({
        resources: [web('api', { runtime: 'node', extraFields: { domain: 'acme.dev' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['DeprecatedField']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'api', field: 'extraFields.domain' });
    expect(result.error.issues[0].message).toContain('domains');
  });

  it('lets the retired singular domain block a worker the web-only rule also warns about', () => {
    const result = validate(
      blueprint({
        resources: [worker('jobs', { runtime: 'node', extraFields: { domain: 'jobs.acme.dev' } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['DeprecatedField']);
  });

  it('reports no retired form for a singular domain on a cron job, which carries none', () => {
    const result = validate(
      blueprint({
        resources: [
          cron('nightly', {
            runtime: 'node',
            schedule: '0 2 * * *',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm report',
            extraFields: { domain: 'nightly.acme.dev' },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(['ExtraFieldNotInSchema']);
  });

  // spec §4.1: maintenance mode needs a paid web service instance.
  it('warns about maintenance mode on a service that writes the free plan', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            plan: 'free',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            maintenanceMode: { enabled: true },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'MaintenanceModeNeedsPaidPlan',
    ]);
    expect(result.value.warnings[0]?.at).toEqual({ resource: 'api', field: 'maintenanceMode' });
  });

  // Render adopts a service by name, so a config that writes no plan may be describing a paid one.
  it('warns about nothing when maintenance mode sits beside no written plan', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
            maintenanceMode: { enabled: true },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('warns about nothing when the free plan sits beside no maintenance mode', () => {
    const result = validate(
      blueprint({
        resources: [
          web('api', {
            runtime: 'node',
            plan: 'free',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm start',
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('warns about maintenance mode in a static site\u2019s extraFields, which its schema lacks', () => {
    const result = validate(
      blueprint({
        resources: [
          staticSite('marketing', {
            buildCommand: 'pnpm build',
            staticPublishPath: './dist',
            extraFields: { maintenanceMode: { enabled: true } },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(['ExtraFieldNotInSchema']);
    expect(result.value.warnings[0]?.at).toEqual({
      resource: 'marketing',
      field: 'extraFields.maintenanceMode',
    });
  });

  it('reports domains in a static site\u2019s extraFields as a conflict, not a field out of reach', () => {
    const result = validate(
      blueprint({
        resources: [staticSite('marketing', { extraFields: { domains: ['acme.dev'] } })],
      }),
    );

    expect(reportedCodes(result)).toEqual(['ExtraFieldConflict']);
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

  // spec §4.3: autoDeployTrigger has no effect for a service that deploys a prebuilt image.
  it('warns about a deploy trigger on every kind an image can source', () => {
    const image = { url: 'docker.io/acme/api:1.0.0' };
    const result = validate(
      blueprint({
        resources: [
          web('api', { runtime: 'image', image, autoDeployTrigger: 'commit' }),
          privateService('auth', { runtime: 'image', image, autoDeployTrigger: 'commit' }),
          worker('jobs', { runtime: 'image', image, autoDeployTrigger: 'off' }),
          cron('nightly', {
            runtime: 'image',
            image,
            schedule: '0 2 * * *',
            autoDeployTrigger: 'checksPass',
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'AutoDeployTriggerOnImageSource',
      'AutoDeployTriggerOnImageSource',
      'AutoDeployTriggerOnImageSource',
      'AutoDeployTriggerOnImageSource',
    ]);
    expect(result.value.warnings.map((warning) => warning.at)).toEqual([
      { resource: 'api', field: 'autoDeployTrigger' },
      { resource: 'auth', field: 'autoDeployTrigger' },
      { resource: 'jobs', field: 'autoDeployTrigger' },
      { resource: 'nightly', field: 'autoDeployTrigger' },
    ]);
  });

  // docs/research/raw/render-preview-environments.md § "Environment variables"
  it('warns about a previewValue on a worker and on a cron job', () => {
    const result = validate(
      blueprint({
        resources: [
          worker('jobs', {
            runtime: 'node',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm run jobs',
            env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) },
          }),
          cron('nightly', {
            runtime: 'node',
            schedule: '0 2 * * *',
            buildCommand: 'pnpm build',
            startCommand: 'pnpm run nightly',
            env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) },
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'PreviewValueIgnored',
      'PreviewValueIgnored',
    ]);
    expect(result.value.warnings.map((warning) => warning.at)).toEqual([
      { resource: 'jobs', field: 'env.LOG_LEVEL' },
      { resource: 'nightly', field: 'env.LOG_LEVEL' },
    ]);
  });

  // spec §5: data persistence is not available for a free instance.
  it('warns about a persistence mode on a free key value instance', () => {
    const result = validate(
      blueprint({
        resources: [
          keyValue('cache', {
            ipAllowList: [{ source: '203.0.113.4/30' }],
            plan: 'free',
            persistenceMode: 'journal-snapshot',
          }),
        ],
      }),
    );

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.warnings.map((warning) => warning.code)).toEqual([
      'PersistenceNeedsPaidPlan',
    ]);
    expect(result.value.warnings[0]?.at).toEqual({ resource: 'cache', field: 'persistenceMode' });
  });

  it('reports a cron schedule that is not a cron expression under its own code', () => {
    const result = validate(
      blueprint({ resources: [cron('nightly-report', { runtime: 'node', schedule: '@daily' })] }),
    );

    expect(reportedCodes(result)).toEqual(['ScheduleNotCron']);
    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.issues[0].at).toEqual({ resource: 'nightly-report', field: 'schedule' });
  });
});
