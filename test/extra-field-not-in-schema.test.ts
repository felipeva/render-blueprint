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
import { renderSchema } from './support/render-schema.js';

const emitted = (value: Blueprint): SynthesisReport =>
  synthesize(value).unwrap('The blueprint under test must synthesize');

const notInSchema = (report: SynthesisReport): readonly string[] =>
  report.warnings
    .filter((warning) => warning.code === 'ExtraFieldNotInSchema')
    .map((warning) => `${warning.at.resource}.${warning.at.field}`);

const rejectedAt = (report: SynthesisReport): readonly string[] => {
  // SAFETY: yaml's parse returns any. Its input is the text synthesize just produced, whose leaves
  // are all JsonValue, so it round-trips into JsonValue.
  const document: JsonValue = parse(report.yaml);

  return renderSchema(document).map((violation) => violation.at);
};

describe('synthesize', () => {
  it('warns about a key serverService lacks, where the schema rejects the service', () => {
    const report = emitted(
      blueprint({
        resources: [web('api', { runtime: 'node', extraFields: { logStream: 'acme-logs' } })],
      }),
    );

    expect(notInSchema(report)).toEqual(['api.extraFields.logStream']);
    expect(rejectedAt(report)).toContain('/services/0');
  });

  it('warns about a key cronService lacks, where the schema rejects the cron job', () => {
    const report = emitted(
      blueprint({
        resources: [
          cron('nightly', {
            runtime: 'node',
            schedule: '0 2 * * *',
            extraFields: { healthCheckPath: '/healthz' },
          }),
        ],
      }),
    );

    expect(notInSchema(report)).toEqual(['nightly.extraFields.healthCheckPath']);
    expect(rejectedAt(report)).toContain('/services/0');
  });

  it('warns about a key staticService lacks, where the schema rejects the static site', () => {
    const report = emitted(
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

    expect(notInSchema(report)).toEqual(['marketing.extraFields.maintenanceMode']);
    expect(rejectedAt(report)).toContain('/services/0');
  });

  it('warns about a key redisServer lacks, where the schema rejects the key value store', () => {
    const report = emitted(
      blueprint({
        resources: [
          keyValue('cache', { ipAllowList: [], extraFields: { maintenanceWindow: 'sun-03:00' } }),
        ],
      }),
    );

    expect(notInSchema(report)).toEqual(['cache.extraFields.maintenanceWindow']);
    expect(rejectedAt(report)).toContain('/services/0');
  });

  it('warns about a key the database definition lacks, where the schema rejects the database', () => {
    const report = emitted(
      blueprint({
        resources: [postgres('elephant', { extraFields: { maintenanceWindow: 'sun-03:00' } })],
      }),
    );

    expect(notInSchema(report)).toEqual(['elephant.extraFields.maintenanceWindow']);
    expect(rejectedAt(report)).toContain('/databases/0');
  });

  it('warns about a key envVarGroup lacks, where the schema rejects the group', () => {
    const report = emitted(
      blueprint({
        resources: [envGroup('shared', { env: { TZ: 'UTC' }, extraFields: { region: 'oregon' } })],
      }),
    );

    expect(notInSchema(report)).toEqual(['shared.extraFields.region']);
    expect(rejectedAt(report)).toContain('/envVarGroups/0');
  });

  it('warns about a key the root lacks, where the schema rejects the document', () => {
    const report = emitted(
      blueprint({
        resources: [web('api', { runtime: 'node' })],
        extraFields: { owner: 'platform' },
      }),
    );

    expect(notInSchema(report)).toEqual(['blueprint.extraFields.owner']);
    expect(rejectedAt(report)).toContain('/');
  });

  it('emits a key the root lists with no warning and a document the schema accepts', () => {
    const report = emitted(
      blueprint({ resources: [web('api', { runtime: 'node' })], extraFields: { version: '1' } }),
    );

    expect(notInSchema(report)).toEqual([]);
    expect(rejectedAt(report)).toEqual([]);
    expect(report.yaml).toContain('version:');
  });
});
