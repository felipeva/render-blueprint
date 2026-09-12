import { describe, expect, it } from 'vitest';

import { external } from '../../references/external.js';
import { cron } from '../../resources/cron.js';
import { keyValue } from '../../resources/key-value.js';
import { postgres, type PostgresConfig } from '../../resources/postgres.js';
import { privateService } from '../../resources/private-service.js';
import { readReplica, type ReadReplica } from '../../resources/read-replica.js';
import type { BlueprintResource } from '../../resources/resource.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { parseConfigs, type ParsedConfigs } from '../parse-configs.js';
import { danglingReference } from './dangling-reference.js';

const parsed = (
  accepted: readonly BlueprintResource[],
  named: readonly BlueprintResource[] = accepted,
  listed: readonly BlueprintResource[] = named,
): ParsedConfigs => ({
  issues: [],
  named,
  accepted,
  replicasKnown: parseConfigs(listed).replicasKnown,
});

// SAFETY: JSON.parse returns any. Every value below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const uncheckedDatabase: (json: string) => PostgresConfig = JSON.parse;
const uncheckedReplica: (json: string) => ReadReplica = JSON.parse;

describe('danglingReference', () => {
  it('reports nothing when the referenced database is listed', () => {
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: database.connectionString } });

    expect(danglingReference(parsed([api, database]))).toEqual([]);
  });

  it('reports nothing when the reference names a listed database read replica', () => {
    const replica = readReplica('elephant-replica');
    const database = postgres('elephant', { readReplicas: [replica] });
    const api = web('api', { runtime: 'node', env: { REPLICA_URL: replica.connectionString } });

    expect(danglingReference(parsed([api, database]))).toEqual([]);
  });

  it('names the source resource, the env key, and the missing target', () => {
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: database.connectionString } });

    expect(danglingReference(parsed([api]))).toEqual([
      {
        code: 'DanglingReference',
        at: { resource: 'api', field: 'env.DATABASE_URL' },
        message:
          '"api" reads "DATABASE_URL" from the database "elephant", which this blueprint does not list. Add it to resources, or declare it as a read replica of a database that is listed.',
      },
    ]);
  });

  it('reports a replica that no listed database declares', () => {
    const replica = readReplica('elephant-replica');
    const database = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { REPLICA_URL: replica.connectionString } });

    expect(danglingReference(parsed([api, database])).map((issue) => issue.at.field)).toEqual([
      'env.REPLICA_URL',
    ]);
  });

  it('reports every dangling reference, never the first only', () => {
    const database = postgres('elephant');
    const api = web('api', {
      runtime: 'node',
      env: { DATABASE_URL: database.connectionString, DATABASE_HOST: database.host },
    });

    expect(danglingReference(parsed([api]))).toHaveLength(2);
  });

  it('reports nothing for a resource with no environment map', () => {
    expect(danglingReference(parsed([postgres('elephant')]))).toEqual([]);
  });

  it('takes its targets from the name tier, so a database with an invalid config still counts', () => {
    const elephant = postgres('elephant');
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: elephant.connectionString } });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('reports no unresolved database reference while a read replica entry is not an object', () => {
    const elephant = postgres('elephant', {
      readReplicas: [uncheckedReplica('null'), uncheckedReplica('"elephant-replica"')],
    });
    const api = web('api', {
      runtime: 'node',
      env: {
        DATABASE_URL: elephant.connectionString,
        REPLICA_URL: readReplica('elephant-replica').connectionString,
      },
    });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('reports no unresolved database reference while an entry that carries a name did not parse', () => {
    const elephant = postgres('elephant', {
      readReplicas: [uncheckedReplica('{"name":"elephant-replica"}')],
    });
    const api = web('api', {
      runtime: 'node',
      env: { REPLICA_URL: readReplica('elephant-reader').connectionString },
    });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('reports nothing for a mistyped database name while a read replica entry did not parse', () => {
    const elephant = postgres('elephant', {
      readReplicas: [uncheckedReplica('"elephant-replica"')],
    });
    const api = web('api', {
      runtime: 'node',
      env: { DATABASE_URL: postgres('elefant').connectionString },
    });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('reports no unresolved database reference while readReplicas is not an array', () => {
    const elephant = postgres('elephant', uncheckedDatabase('{"readReplicas":"elephant-replica"}'));
    const api = web('api', {
      runtime: 'node',
      env: { REPLICA_URL: readReplica('elephant-replica').connectionString },
    });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('reports nothing for a listed database beside a read replica entry that did not parse', () => {
    const elephant = postgres('elephant', { readReplicas: [uncheckedReplica('null')] });
    const api = web('api', { runtime: 'node', env: { DATABASE_URL: elephant.connectionString } });

    expect(danglingReference(parsed([api], [api, elephant]))).toEqual([]);
  });

  it('still reports a service reference beside a read replica entry that did not parse', () => {
    const elephant = postgres('elephant', { readReplicas: [uncheckedReplica('null')] });
    const api = web('api', {
      runtime: 'node',
      env: {
        AUTH_HOSTPORT: web('auth', { runtime: 'node' }).hostport,
        DATABASE_URL: postgres('elefant').connectionString,
      },
    });

    expect(danglingReference(parsed([api], [api, elephant])).map((issue) => issue.at)).toEqual([
      { resource: 'api', field: 'env.AUTH_HOSTPORT' },
    ]);
  });

  it('reports a name no database or read replica takes once every entry parsed', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('elephant-replica')] });
    const api = web('api', {
      runtime: 'node',
      env: { REPLICA_URL: readReplica('elephant-reader').connectionString },
    });

    expect(danglingReference(parsed([api, elephant])).map((issue) => issue.at)).toEqual([
      { resource: 'api', field: 'env.REPLICA_URL' },
    ]);
  });

  it('reports no unresolved database reference while a database whose name did not parse declares an unparsed replica', () => {
    const nameless = postgres('', { readReplicas: [uncheckedReplica('"elephant-replica"')] });
    const api = web('api', {
      runtime: 'node',
      env: { REPLICA_URL: readReplica('elephant-replica').connectionString },
    });

    expect(danglingReference(parsed([api], [api], [api, nameless]))).toEqual([]);
  });

  it('reports nothing when the referenced service is listed', () => {
    const cache = keyValue('cache', { ipAllowList: [] });
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', {
      runtime: 'node',
      env: { CACHE_URL: cache.connectionString, AUTH_HOSTPORT: auth.hostport },
    });

    expect(danglingReference(parsed([api, auth, cache]))).toEqual([]);
  });

  it('names the source resource, the env key, and the missing service', () => {
    const auth = web('auth', { runtime: 'node' });
    const api = web('api', { runtime: 'node', env: { AUTH_HOSTPORT: auth.hostport } });

    expect(danglingReference(parsed([api]))).toEqual([
      {
        code: 'DanglingReference',
        at: { resource: 'api', field: 'env.AUTH_HOSTPORT' },
        message:
          '"api" reads "AUTH_HOSTPORT" from the service "auth", which this blueprint does not list. Add it to resources, or reach for it through an external handle.',
      },
    ]);
  });

  it('reports a reference whose name a listed service of another kind takes', () => {
    const cache = keyValue('cache', { ipAllowList: [] });
    const decoy = web('cache', { runtime: 'node' });
    const api = web('api', { runtime: 'node', env: { CACHE_URL: cache.connectionString } });

    expect(danglingReference(parsed([api, decoy]))).toEqual([
      {
        code: 'DanglingReference',
        at: { resource: 'api', field: 'env.CACHE_URL' },
        message:
          '"api" reads "CACHE_URL" from the "keyvalue" service "cache", and the only "cache" this blueprint lists is a "web" service. Render resolves a fromService reference by name and type together.',
      },
    ]);
  });

  it('reports nothing when the listed service of that name is of the referenced kind', () => {
    const cache = keyValue('cache', { ipAllowList: [] });
    const api = web('api', { runtime: 'node', env: { CACHE_URL: cache.connectionString } });

    expect(danglingReference(parsed([api, cache]))).toEqual([]);
  });

  it('reports nothing for a reference an external handle produced', () => {
    const api = web('api', {
      runtime: 'node',
      env: {
        AUTH_HOSTPORT: external.privateService('legacy-auth').hostport,
        LEGACY_URL: external.postgres('legacy-db').connectionString,
        SHARED_CACHE: external.keyValue('shared-cache').connectionString,
      },
    });

    expect(danglingReference(parsed([api]))).toEqual([]);
  });

  it('reports nothing for a service referencing itself', () => {
    const api = web('api', {
      runtime: 'node',
      env: (self) => ({ APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME') }),
    });

    expect(danglingReference(parsed([api]))).toEqual([]);
  });

  it('reports a service reference whose target is a database, which answers fromDatabase', () => {
    const api = web('api', { runtime: 'node' });
    const billing = web('billing', { runtime: 'node', env: { API_HOST: api.host } });

    expect(
      danglingReference(parsed([billing, postgres('api')])).map((issue) => issue.at.field),
    ).toEqual(['env.API_HOST']);
  });

  it('resolves a reference to each service kind by the type Render publishes for it', () => {
    const auth = privateService('auth', { runtime: 'node' });
    const jobs = worker('jobs', { runtime: 'node' });
    const nightly = cron('nightly', { runtime: 'node', schedule: '0 2 * * *' });
    const api = web('api', {
      runtime: 'node',
      env: {
        AUTH_HOSTPORT: auth.hostport,
        JOBS_TOKEN: jobs.envVar('TOKEN'),
        NIGHTLY_TOKEN: nightly.envVar('TOKEN'),
      },
    });

    expect(danglingReference(parsed([api, auth, jobs, nightly]))).toEqual([]);
  });

  it('reports a reference to a worker no blueprint lists', () => {
    const api = web('api', {
      runtime: 'node',
      env: { JOBS_TOKEN: worker('jobs', { runtime: 'node' }).envVar('TOKEN') },
    });

    expect(danglingReference(parsed([api])).map((issue) => issue.at.field)).toEqual([
      'env.JOBS_TOKEN',
    ]);
  });

  it('reaches the environment map of a worker, a private service and a cron job', () => {
    const elephant = postgres('elephant');
    const jobs = worker('jobs', {
      runtime: 'node',
      env: { DATABASE_URL: elephant.connectionString },
    });
    const auth = privateService('auth', {
      runtime: 'node',
      env: { DATABASE_URL: elephant.connectionString },
    });
    const nightly = cron('nightly', {
      runtime: 'node',
      schedule: '0 2 * * *',
      env: { DATABASE_URL: elephant.connectionString },
    });

    expect(
      danglingReference(parsed([jobs, auth, nightly])).map((issue) => issue.at.resource),
    ).toEqual(['jobs', 'auth', 'nightly']);
  });

  it('reaches the environment map of every kind that carries one, a static site included', () => {
    const elephant = postgres('elephant');
    const docs = staticSite('docs', { env: { DATABASE_URL: elephant.connectionString } });

    expect(danglingReference(parsed([docs]))).toEqual([
      {
        code: 'DanglingReference',
        at: { resource: 'docs', field: 'env.DATABASE_URL' },
        message:
          '"docs" reads "DATABASE_URL" from the database "elephant", which this blueprint does not list. Add it to resources, or declare it as a read replica of a database that is listed.',
      },
    ]);
  });
});
