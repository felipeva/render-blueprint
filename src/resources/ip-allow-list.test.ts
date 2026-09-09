import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { blueprint } from '../blueprint/blueprint.js';
import { withDefaults } from '../defaults/with-defaults.js';
import { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import type { ValidationIssue } from '../validation/issue.js';
import { validate } from '../validation/validate.js';
import { keyValue } from './key-value.js';
import { postgres } from './postgres.js';
import type { BlueprintResource } from './resource.js';
import { staticSite } from './static-site.js';
import { parseWebConfig, web, type WebConfig } from './web.js';

const raisedIssues: (config: WebConfig) => readonly RaisedIssue[] =
  raisedIssuesThrough(parseWebConfig);

const sourceIssues = (source: string): readonly RaisedIssue[] =>
  raisedIssues({ runtime: 'node', ipAllowList: [{ source }] });

const reportedIssues = (resource: BlueprintResource): readonly ValidationIssue[] => {
  const result = validate(blueprint({ resources: [resource] }));
  return Result.isError(result) ? result.error.issues : [];
};

const ACCEPTED_SOURCES: readonly string[] = [
  '203.0.113.4',
  '203.0.113.4/30',
  '0.0.0.0/0',
  '10.0.0.0/8',
  '2001:db8::1',
  '2001:db8::/32',
  '::1',
  '::',
  '::/0',
  '2001:0db8:0000:0000:0000:0000:0000:0001',
  '::ffff:203.0.113.4',
];

const REFUSED_SOURCES: readonly string[] = [
  '',
  'office',
  '203.0.113',
  '203.0.113.256',
  '203.0.113.4/33',
  '203.0.113.4/',
  '203.0.113.4 /30',
  '2001:db8:::1',
  '2001:db8::1/129',
  'fe80::1%eth0',
  '1.2.3.4/8x',
  '2001:db8::1::2',
];

describe('ipAllowListSchema', () => {
  it.each(ACCEPTED_SOURCES)('accepts %j as a source', (source: string) => {
    expect(sourceIssues(source)).toEqual([]);
  });

  it.each(REFUSED_SOURCES)('refuses %j as a source', (source: string) => {
    expect(sourceIssues(source)).toEqual([
      { validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 0, 'source'] },
    ]);
  });

  it('refuses an octet written with a leading zero, which reads as octal elsewhere', () => {
    expect(sourceIssues('01.2.3.4')).toEqual([
      { validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 0, 'source'] },
    ]);
  });

  it('refuses a prefix length written with a leading zero', () => {
    expect(sourceIssues('203.0.113.4/08')).toEqual([
      { validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 0, 'source'] },
    ]);
  });

  it('reports the entry that fails and leaves the entry beside it alone', () => {
    expect(
      raisedIssues({
        runtime: 'node',
        ipAllowList: [{ source: '203.0.113.4/30' }, { source: 'office' }, { source: '::1' }],
      }),
    ).toEqual([{ validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 1, 'source'] }]);
  });

  it('reports one issue for each entry that fails', () => {
    expect(
      raisedIssues({ runtime: 'node', ipAllowList: [{ source: 'office' }, { source: 'home' }] }),
    ).toEqual([
      { validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 0, 'source'] },
      { validationCode: 'IpAllowListSourceNotCidr', path: ['ipAllowList', 1, 'source'] },
    ]);
  });

  it('reports a bad source on a web service', () => {
    expect(
      reportedIssues(web('api', { runtime: 'node', ipAllowList: [{ source: 'office' }] })),
    ).toEqual([
      {
        code: 'IpAllowListSourceNotCidr',
        at: { resource: 'api', field: 'ipAllowList.0.source' },
        message: expect.stringContaining('CIDR'),
      },
    ]);
  });

  it('reports a bad source on a static site', () => {
    expect(
      reportedIssues(staticSite('marketing', { ipAllowList: [{ source: 'office' }] })),
    ).toEqual([
      {
        code: 'IpAllowListSourceNotCidr',
        at: { resource: 'marketing', field: 'ipAllowList.0.source' },
        message: expect.stringContaining('CIDR'),
      },
    ]);
  });

  it('reports a bad source on a key value store', () => {
    expect(reportedIssues(keyValue('cache', { ipAllowList: [{ source: 'office' }] }))).toEqual([
      {
        code: 'IpAllowListSourceNotCidr',
        at: { resource: 'cache', field: 'ipAllowList.0.source' },
        message: expect.stringContaining('CIDR'),
      },
    ]);
  });

  it('reports a bad source on a Postgres database', () => {
    expect(reportedIssues(postgres('elephant', { ipAllowList: [{ source: 'office' }] }))).toEqual([
      {
        code: 'IpAllowListSourceNotCidr',
        at: { resource: 'elephant', field: 'ipAllowList.0.source' },
        message: expect.stringContaining('CIDR'),
      },
    ]);
  });

  it('reports a scope default with a bad source on every resource it reached', () => {
    const scope = withDefaults({ ipAllowList: [{ source: 'office' }] });
    const result = validate(
      blueprint({
        resources: [
          scope.web('api', { runtime: 'node' }),
          scope.staticSite('marketing', {}),
          scope.postgres('elephant'),
        ],
      }),
    );

    expect(Result.isError(result)).toBe(true);

    if (Result.isError(result)) {
      expect(BlueprintInvalid.is(result.error)).toBe(true);
      expect(result.error.issues).toEqual([
        {
          code: 'IpAllowListSourceNotCidr',
          at: { resource: 'api', field: 'ipAllowList.0.source' },
          message: expect.stringContaining('takes "ipAllowList" from a defaults scope'),
        },
        {
          code: 'IpAllowListSourceNotCidr',
          at: { resource: 'marketing', field: 'ipAllowList.0.source' },
          message: expect.stringContaining('takes "ipAllowList" from a defaults scope'),
        },
        {
          code: 'IpAllowListSourceNotCidr',
          at: { resource: 'elephant', field: 'ipAllowList.0.source' },
          message: expect.stringContaining('takes "ipAllowList" from a defaults scope'),
        },
      ]);
    }
  });
});
