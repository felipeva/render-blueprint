import { describe, expect, it } from 'vitest';

import { parsePostgresConfig, postgres, type PostgresConfig } from './postgres.js';
import { readReplica } from './read-replica.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => PostgresConfig = JSON.parse;

const issueCodes = (config: PostgresConfig): readonly string[] => {
  const result = parsePostgresConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

interface RaisedIssue {
  readonly validationCode: string;
  readonly path: readonly PropertyKey[];
}

const raisedIssues = (config: PostgresConfig): readonly RaisedIssue[] => {
  const result = parsePostgresConfig(config);
  if (result.success) return [];

  return result.error.issues.flatMap((issue): readonly RaisedIssue[] =>
    issue.code === 'custom'
      ? [{ validationCode: String(issue.params?.['validationCode']), path: issue.path }]
      : [],
  );
};

describe('postgres', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: PostgresConfig = { plan: 'basic-1gb', region: 'oregon' };
    const database = postgres('elephant', config);

    expect(database.kind).toBe('postgres');
    expect(database.name).toBe('elephant');
    expect(database.config).toBe(config);
  });

  it('takes no config, because Render requires only a name', () => {
    expect(postgres('elephant').config).toEqual({});
  });

  it('exposes a handle that references its own name', () => {
    expect(postgres('elephant').connectionString).toEqual({
      reference: 'fromDatabase',
      name: 'elephant',
      origin: 'blueprint',
      property: 'connectionString',
    });
  });
});

describe('parsePostgresConfig', () => {
  it('accepts a config that fills every modeled field', () => {
    expect(
      issueCodes({
        region: 'frankfurt',
        plan: 'pro-8gb',
        databaseName: 'elephant',
        user: 'elephant_user',
        postgresMajorVersion: '17',
        diskSizeGB: 35,
        highAvailability: { enabled: true },
        ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
        readReplicas: [readReplica('elephant-replica')],
        extraFields: { connectionPool: 'pgbouncer' },
      }),
    ).toEqual([]);
  });

  it('rejects a field the library does not model', () => {
    expect(issueCodes(unchecked('{"connectionPool":"pgbouncer"}'))).toEqual(['unrecognized_keys']);
  });

  it('rejects a disk size that is neither 1 nor a multiple of 5', () => {
    expect(issueCodes(unchecked('{"diskSizeGB":33}'))).toEqual(['invalid_value']);
  });

  it('reports high availability below PostgreSQL 13 on the highAvailability field', () => {
    expect(
      raisedIssues({ postgresMajorVersion: '12', highAvailability: { enabled: true } }),
    ).toEqual([{ validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] }]);
  });

  it('accepts high availability from PostgreSQL 13 up', () => {
    expect(issueCodes({ postgresMajorVersion: '13', highAvailability: { enabled: true } })).toEqual(
      [],
    );
  });

  it('accepts high availability with no version, because Render defaults to the latest', () => {
    expect(issueCodes({ highAvailability: { enabled: true } })).toEqual([]);
  });

  it('accepts high availability turned off below PostgreSQL 13', () => {
    expect(
      issueCodes({ postgresMajorVersion: '12', highAvailability: { enabled: false } }),
    ).toEqual([]);
  });

  it('reports a sixth read replica on the readReplicas field', () => {
    expect(raisedIssues({ readReplicas: ['a', 'b', 'c', 'd', 'e', 'f'].map(readReplica) })).toEqual(
      [{ validationCode: 'TooManyReadReplicas', path: ['readReplicas'] }],
    );
  });

  it('accepts five read replicas', () => {
    expect(issueCodes({ readReplicas: ['a', 'b', 'c', 'd', 'e'].map(readReplica) })).toEqual([]);
  });

  it('rejects a read replica the factory did not build', () => {
    expect(issueCodes(unchecked('{"readReplicas":[{"name":"elephant-replica"}]}'))).not.toEqual([]);
  });
});
