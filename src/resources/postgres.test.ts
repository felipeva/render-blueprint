import { describe, expect, it } from 'vitest';

import { POSTGRES_PLANS } from '../enums/plan.js';
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

const issueMessages = (config: PostgresConfig): readonly string[] => {
  const result = parsePostgresConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
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
        storageAutoscalingEnabled: true,
        connectionPool: 'pgbouncer',
        previews: { plan: 'basic-1gb', diskSizeGB: 5 },
        highAvailability: { enabled: true },
        ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }],
        readReplicas: [readReplica('elephant-replica')],
        extraFields: { maintenanceWindow: 'sun-03:00' },
      }),
    ).toEqual([]);
  });

  it('rejects a field the library does not model', () => {
    expect(issueCodes(unchecked('{"maintenanceWindow":"sun-03:00"}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('rejects a connection pool Render does not publish', () => {
    expect(issueCodes(unchecked('{"connectionPool":"pgpool"}'))).toEqual(['invalid_value']);
  });

  it('rejects storage autoscaling written as a string', () => {
    expect(issueCodes(unchecked('{"storageAutoscalingEnabled":"true"}'))).toEqual(['invalid_type']);
  });

  it('reports a disk size that is neither 1 nor a multiple of 5 on the diskSizeGB field', () => {
    expect(raisedIssues({ diskSizeGB: 7 })).toEqual([
      { validationCode: 'DiskSizeDisallowed', path: ['diskSizeGB'] },
    ]);
  });

  it('reports a preview disk size that breaks the same rule at its own path', () => {
    expect(raisedIssues({ previews: { diskSizeGB: 7 } })).toEqual([
      { validationCode: 'DiskSizeDisallowed', path: ['previews', 'diskSizeGB'] },
    ]);
  });

  it('accepts 1 and every multiple of 5, however large', () => {
    expect([1, 5, 4000, 4005, 10000].flatMap((diskSizeGB) => issueCodes({ diskSizeGB }))).toEqual(
      [],
    );
  });

  it('accepts a preview disk size above the ceiling the library once spelled', () => {
    expect(issueCodes({ previews: { diskSizeGB: 4005 } })).toEqual([]);
  });

  it('reports a disk size below 1 the way every bounded integer reports one', () => {
    expect(raisedIssues({ diskSizeGB: 0 })).toEqual([
      { validationCode: 'OutOfRange', path: ['diskSizeGB'] },
    ]);
    expect(raisedIssues({ diskSizeGB: -5 })).toEqual([
      { validationCode: 'OutOfRange', path: ['diskSizeGB'] },
    ]);
  });

  it('reports both codes for a disk size that is below 1 and not a multiple of 5', () => {
    expect(raisedIssues({ diskSizeGB: -3 })).toEqual([
      { validationCode: 'OutOfRange', path: ['diskSizeGB'] },
      { validationCode: 'DiskSizeDisallowed', path: ['diskSizeGB'] },
    ]);
    expect(raisedIssues({ previews: { diskSizeGB: -3 } })).toEqual([
      { validationCode: 'OutOfRange', path: ['previews', 'diskSizeGB'] },
      { validationCode: 'DiskSizeDisallowed', path: ['previews', 'diskSizeGB'] },
    ]);
  });

  it('reports a fractional disk size as an integer failure and nothing else', () => {
    expect(issueCodes({ diskSizeGB: 2.5 })).toEqual(['invalid_type']);
    expect(raisedIssues({ diskSizeGB: 2.5 })).toEqual([]);
  });

  it('reports the disk-size rule beside a value another field refuses', () => {
    const config = unchecked('{"region":"dublin","diskSizeGB":7}');

    expect(issueCodes(config)).toEqual(['invalid_value', 'custom']);
    expect(raisedIssues(config)).toEqual([
      { validationCode: 'DiskSizeDisallowed', path: ['diskSizeGB'] },
    ]);
  });

  it('rejects a field the library does not model inside previews', () => {
    expect(issueCodes(unchecked('{"previews":{"generation":"automatic"}}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('rejects a field the library does not model on an ipAllowList entry', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[{"source":"::1","label":"all"}]}'))).toEqual([
      'unrecognized_keys',
    ]);
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

  it('reports the disk-size rule beside the high-availability rule the same config trips', () => {
    expect(
      raisedIssues({
        postgresMajorVersion: '12',
        diskSizeGB: 7,
        highAvailability: { enabled: true },
      }),
    ).toEqual([
      { validationCode: 'DiskSizeDisallowed', path: ['diskSizeGB'] },
      { validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] },
    ]);
  });

  it('reports high availability below PostgreSQL 13 beside a region that did not parse', () => {
    expect(
      raisedIssues(
        unchecked(
          '{"region":"mars","postgresMajorVersion":"12","highAvailability":{"enabled":true}}',
        ),
      ),
    ).toEqual([{ validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] }]);
  });

  it('reports nothing from the high-availability rule when the version it reads did not parse', () => {
    expect(
      raisedIssues(unchecked('{"postgresMajorVersion":12,"highAvailability":{"enabled":true}}')),
    ).toEqual([]);
  });

  it.each(['free', '0.1c-256mb', '0.5c-1g'] as const)(
    'reports the %j plan under one CPU on the highAvailability field',
    (plan) => {
      expect(raisedIssues({ plan, highAvailability: { enabled: true } })).toEqual([
        { validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] },
      ]);
    },
  );

  it('names the plan and the CPU the plan lacks', () => {
    expect(issueMessages({ plan: '0.5c-1g', highAvailability: { enabled: true } })).toEqual([
      expect.stringContaining('"0.5c-1g"'),
    ]);
    expect(issueMessages({ plan: '0.5c-1g', highAvailability: { enabled: true } })).toEqual([
      expect.stringContaining('1 CPU'),
    ]);
  });

  it.each(['1c-2g', '1c-4g', '128c-1024g'] as const)(
    'accepts high availability on the %j plan',
    (plan) => {
      expect(issueCodes({ plan, highAvailability: { enabled: true } })).toEqual([]);
    },
  );

  it.each([
    'starter',
    'standard',
    'pro',
    'pro plus',
    'basic-1gb',
    'pro-4gb',
    'accelerated-16gb',
  ] as const)('accepts high availability on the legacy %j plan', (plan) => {
    expect(issueCodes({ plan, highAvailability: { enabled: true } })).toEqual([]);
  });

  it('accepts high availability with no plan, because the library injects no Render default', () => {
    expect(issueCodes({ highAvailability: { enabled: true } })).toEqual([]);
  });

  it.each(['free', '0.1c-256mb', '0.5c-1g'] as const)(
    'accepts the %j plan with high availability turned off',
    (plan) => {
      expect(issueCodes({ plan, highAvailability: { enabled: false } })).toEqual([]);
    },
  );

  it.each(['free', '0.1c-256mb', '0.5c-1g'] as const)(
    'accepts the %j plan with no high availability',
    (plan) => {
      expect(issueCodes({ plan })).toEqual([]);
    },
  );

  it('refuses high availability on exactly the plans Render gives less than one CPU', () => {
    const refused = POSTGRES_PLANS.filter(
      (plan) => issueCodes({ plan, highAvailability: { enabled: true } }).length > 0,
    );

    expect(refused).toEqual(['free', '0.1c-256mb', '0.5c-1g']);
  });

  it('reports the version rule and the plan rule from one database, each with its own message', () => {
    const config: PostgresConfig = {
      plan: '0.5c-1g',
      postgresMajorVersion: '12',
      highAvailability: { enabled: true },
    };

    expect(raisedIssues(config)).toEqual([
      { validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] },
      { validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] },
    ]);
    expect(issueMessages(config)).toEqual([
      expect.stringContaining('"12"'),
      expect.stringContaining('"0.5c-1g"'),
    ]);
  });

  it('reports the version rule when the plan the other rule reads did not parse', () => {
    expect(
      raisedIssues(
        unchecked(
          '{"plan":"gigantic","postgresMajorVersion":"12","highAvailability":{"enabled":true}}',
        ),
      ),
    ).toEqual([{ validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] }]);
  });

  it('reports the plan rule when the version the other rule reads did not parse', () => {
    expect(
      raisedIssues(
        unchecked(
          '{"plan":"0.5c-1g","postgresMajorVersion":12,"highAvailability":{"enabled":true}}',
        ),
      ),
    ).toEqual([{ validationCode: 'HighAvailabilityUnsupported', path: ['highAvailability'] }]);
  });

  it('reports a sixth read replica beside a replica that did not parse', () => {
    expect(raisedIssues(unchecked('{"readReplicas":["a","b","c","d","e","f"]}'))).toEqual([
      { validationCode: 'TooManyReadReplicas', path: ['readReplicas'] },
    ]);
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
