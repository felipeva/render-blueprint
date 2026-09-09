import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { envGroup } from '../../resources/env-group.js';
import { keyValue } from '../../resources/key-value.js';
import { postgres } from '../../resources/postgres.js';
import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { extraFieldNotInSchema } from './extra-field-not-in-schema.js';

describe('extraFieldNotInSchema', () => {
  it('warns about a key serverService does not list, on a web service', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      web('api', { runtime: 'node', extraFields: { maintenanceWindow: 'sun-03:00' } }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'ExtraFieldNotInSchema',
        at: { resource: 'api', field: 'extraFields.maintenanceWindow' },
        message: expect.stringContaining('"serverService"'),
      },
    ]);
    expect(warnings[0]?.message).toContain('maintenanceWindow');
    expect(warnings[0]?.message).toContain('web service');
  });

  it('warns about nothing when the definition lists the key', () => {
    expect(
      extraFieldNotInSchema(undefined, [
        web('api', { runtime: 'node', extraFields: { autoDeploy: true } }),
      ]),
    ).toEqual([]);
  });

  it('warns about every unlisted key, in the order the author wrote them', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      web('api', {
        runtime: 'node',
        extraFields: { logStream: 'acme-logs', autoDeploy: true, maintenanceWindow: 'sun-03:00' },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'extraFields.logStream',
      'extraFields.maintenanceWindow',
    ]);
  });

  it('names serverService for a private service and for a worker', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      privateService('auth', { runtime: 'node', extraFields: { logStream: 'acme-logs' } }),
      worker('jobs', { runtime: 'node', extraFields: { logStream: 'acme-logs' } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'auth', field: 'extraFields.logStream' },
      { resource: 'jobs', field: 'extraFields.logStream' },
    ]);
    expect(warnings.map((warning) => warning.code)).toEqual([
      'ExtraFieldNotInSchema',
      'ExtraFieldNotInSchema',
    ]);
    expect(warnings[0]?.message).toContain('"serverService"');
    expect(warnings[1]?.message).toContain('"serverService"');
  });

  it('warns about a key cronService does not list, on a cron job', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        extraFields: { healthCheckPath: '/healthz' },
      }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'nightly', field: 'extraFields.healthCheckPath' },
    ]);
    expect(warnings[0]?.message).toContain('"cronService"');
    expect(warnings[0]?.message).toContain('cron job');
  });

  it('warns about the domains a cron job cannot carry', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        extraFields: { domains: ['nightly.acme.dev'] },
      }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'nightly', field: 'extraFields.domains' },
    ]);
    expect(warnings[0]?.message).toContain('"cronService"');
  });

  it('warns about a first-deploy hook on a cron job and on a static site', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        extraFields: { initialDeployHook: './seed.sh' },
      }),
      staticSite('marketing', { extraFields: { initialDeployHook: './seed.sh' } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'nightly', field: 'extraFields.initialDeployHook' },
      { resource: 'marketing', field: 'extraFields.initialDeployHook' },
    ]);
    expect(warnings.map((warning) => warning.code)).toEqual([
      'ExtraFieldNotInSchema',
      'ExtraFieldNotInSchema',
    ]);
  });

  it('warns about a key staticService does not list, on a static site', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      staticSite('marketing', { extraFields: { maintenanceMode: { enabled: true } } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'marketing', field: 'extraFields.maintenanceMode' },
    ]);
    expect(warnings[0]?.message).toContain('"staticService"');
    expect(warnings[0]?.message).toContain('static site');
  });

  it('judges a static site against staticService although it emits type web', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      staticSite('marketing', { extraFields: { healthCheckPath: '/healthz' } }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual(['extraFields.healthCheckPath']);
    expect(warnings[0]?.message).toContain('"staticService"');
  });

  it('warns about a key redisServer does not list, on a key value store', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      keyValue('cache', { ipAllowList: [], extraFields: { maintenanceWindow: 'sun-03:00' } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'cache', field: 'extraFields.maintenanceWindow' },
    ]);
    expect(warnings[0]?.message).toContain('"redisServer"');
  });

  it('warns about a key the database definition does not list, on a Postgres database', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      postgres('elephant', { extraFields: { maintenanceWindow: 'sun-03:00' } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'elephant', field: 'extraFields.maintenanceWindow' },
    ]);
    expect(warnings[0]?.message).toContain('"database"');
  });

  it('warns about a key envVarGroup does not list, on an environment group', () => {
    const warnings = extraFieldNotInSchema(undefined, [
      envGroup('shared', { env: { TZ: 'UTC' }, extraFields: { region: 'oregon' } }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'shared', field: 'extraFields.region' },
    ]);
    expect(warnings[0]?.message).toContain('"envVarGroup"');
  });

  it('warns about a key the blueprint root does not list', () => {
    const warnings = extraFieldNotInSchema({ owner: 'platform' }, []);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'blueprint', field: 'extraFields.owner' },
    ]);
    expect(warnings[0]?.code).toBe('ExtraFieldNotInSchema');
    expect(warnings[0]?.message).toContain('blueprint root');
  });

  it('warns about nothing at a root key the schema lists', () => {
    expect(extraFieldNotInSchema({ version: '1' }, [])).toEqual([]);
  });

  it('reports the root before the resources', () => {
    const warnings = extraFieldNotInSchema({ owner: 'platform' }, [
      web('api', { runtime: 'node', extraFields: { logStream: 'acme-logs' } }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['blueprint', 'api']);
  });

  it('warns about nothing when neither the root nor a resource sets extra fields', () => {
    expect(extraFieldNotInSchema(undefined, [web('api', { runtime: 'node' })])).toEqual([]);
  });
});
