import { describe, expect, it } from 'vitest';

import { external } from './external.js';

describe('external', () => {
  it('marks every service handle it builds as external', () => {
    expect([
      external.web('site').host.origin,
      external.privateService('legacy-auth').host.origin,
      external.worker('jobs').envVar('TOKEN').origin,
      external.cron('nightly').envVar('TOKEN').origin,
      external.staticSite('docs').envVar('TOKEN').origin,
      external.keyValue('cache').connectionString.origin,
      external.postgres('legacy-db').connectionString.origin,
    ]).toEqual([
      'external',
      'external',
      'external',
      'external',
      'external',
      'external',
      'external',
    ]);
  });

  it('names the fromService type Render publishes for each kind', () => {
    expect([
      external.web('site').host.type,
      external.privateService('legacy-auth').host.type,
      external.worker('jobs').envVar('TOKEN').type,
      external.cron('nightly').envVar('TOKEN').type,
      external.staticSite('docs').envVar('TOKEN').type,
      external.keyValue('cache').connectionString.type,
    ]).toEqual(['web', 'pserv', 'worker', 'cron', 'static', 'keyvalue']);
  });

  // spec §4.2: a registry credential is never declared in a blueprint.
  it('names a registry credential the workspace holds', () => {
    expect(external.registryCredential('acme-dockerhub')).toEqual({
      fromRegistryCreds: { name: 'acme-dockerhub' },
    });
  });

  it('reads a database property through the fromDatabase form', () => {
    expect(external.postgres('legacy-db').connectionString).toEqual({
      reference: 'fromDatabase',
      name: 'legacy-db',
      origin: 'external',
      property: 'connectionString',
    });
  });
});
