import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  blueprint,
  cron,
  envGroup,
  keyValue,
  postgres,
  staticSite,
  synthesize,
  web,
  type Blueprint,
  type JsonValue,
  type SynthesisReport,
} from '../src/index.js';
import { renderSchema, type SchemaViolation } from './support/render-schema.js';

const emitted = (value: Blueprint): SynthesisReport =>
  synthesize(value).unwrap('The blueprint under test must synthesize');

const notInSchema = (report: SynthesisReport): readonly string[] =>
  report.warnings
    .filter((warning) => warning.code === 'ExtraFieldNotInSchema')
    .map((warning) => `${warning.at.resource}.${warning.at.field}`);

const violations = (report: SynthesisReport): readonly SchemaViolation[] => {
  // SAFETY: yaml's parse returns any. Its input is the text synthesize just produced, whose leaves
  // are all JsonValue, so it round-trips into JsonValue.
  const document: JsonValue = parse(report.yaml);

  return renderSchema(document);
};

const ADDITIONAL = 'must NOT have additional properties';

const UNEVALUATED = 'must NOT have unevaluated properties';

interface ClosedCase {
  readonly definition: string;
  readonly resource: string;
  readonly key: string;
  readonly at: string;
  readonly violation: string;
  readonly carrying: Blueprint;
  readonly without: Blueprint;
}

const CLOSED_CASES: readonly ClosedCase[] = [
  {
    definition: 'serverService',
    resource: 'api',
    key: 'logStream',
    at: '/services/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [web('api', { runtime: 'node', extraFields: { logStream: 'acme-logs' } })],
    }),
    without: blueprint({ resources: [web('api', { runtime: 'node' })] }),
  },
  {
    definition: 'cronService',
    resource: 'nightly',
    key: 'healthCheckPath',
    at: '/services/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [
        cron('nightly', {
          runtime: 'node',
          schedule: '0 2 * * *',
          extraFields: { healthCheckPath: '/healthz' },
        }),
      ],
    }),
    without: blueprint({
      resources: [cron('nightly', { runtime: 'node', schedule: '0 2 * * *' })],
    }),
  },
  {
    definition: 'staticService',
    resource: 'marketing',
    key: 'maintenanceMode',
    at: '/services/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [
        staticSite('marketing', {
          buildCommand: 'pnpm build',
          staticPublishPath: './dist',
          extraFields: { maintenanceMode: { enabled: true } },
        }),
      ],
    }),
    without: blueprint({
      resources: [
        staticSite('marketing', { buildCommand: 'pnpm build', staticPublishPath: './dist' }),
      ],
    }),
  },
  {
    definition: 'redisServer',
    resource: 'cache',
    key: 'maintenanceWindow',
    at: '/services/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [
        keyValue('cache', { ipAllowList: [], extraFields: { maintenanceWindow: 'sun-03:00' } }),
      ],
    }),
    without: blueprint({ resources: [keyValue('cache', { ipAllowList: [] })] }),
  },
  {
    definition: 'database',
    resource: 'elephant',
    key: 'maintenanceWindow',
    at: '/databases/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [postgres('elephant', { extraFields: { maintenanceWindow: 'sun-03:00' } })],
    }),
    without: blueprint({ resources: [postgres('elephant')] }),
  },
  {
    definition: 'envVarGroup',
    resource: 'shared',
    key: 'region',
    at: '/envVarGroups/0',
    violation: ADDITIONAL,
    carrying: blueprint({
      resources: [envGroup('shared', { env: { TZ: 'UTC' }, extraFields: { region: 'oregon' } })],
    }),
    without: blueprint({ resources: [envGroup('shared', { env: { TZ: 'UTC' } })] }),
  },
  {
    definition: 'the blueprint root',
    resource: 'blueprint',
    key: 'owner',
    at: '/',
    violation: UNEVALUATED,
    carrying: blueprint({
      resources: [web('api', { runtime: 'node' })],
      extraFields: { owner: 'platform' },
    }),
    without: blueprint({ resources: [web('api', { runtime: 'node' })] }),
  },
];

describe('synthesize', () => {
  for (const closed of CLOSED_CASES) {
    describe(closed.definition, () => {
      it('warns about a key it lacks, where the schema rejects the same document', () => {
        const report = emitted(closed.carrying);

        expect(notInSchema(report)).toEqual([`${closed.resource}.extraFields.${closed.key}`]);
        expect(violations(report)).toContainEqual({
          at: closed.at,
          message: closed.violation,
        });
      });

      it('warns about nothing without that key, where the schema accepts the document', () => {
        const report = emitted(closed.without);

        expect(notInSchema(report)).toEqual([]);
        expect(violations(report)).toEqual([]);
      });
    });
  }

  it('emits a key the root lists with no warning and a document the schema accepts', () => {
    const report = emitted(
      blueprint({ resources: [web('api', { runtime: 'node' })], extraFields: { version: '1' } }),
    );

    expect(notInSchema(report)).toEqual([]);
    expect(violations(report)).toEqual([]);
    expect(report.yaml).toContain('version:');
  });
});
