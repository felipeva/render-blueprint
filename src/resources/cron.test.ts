import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { cron, parseCronConfig, type CronConfig } from './cron.js';

// SAFETY: JSON.parse returns any. The config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => CronConfig = JSON.parse;

const issueCodes = (config: CronConfig): readonly string[] => {
  const result = parseCronConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

const raisedIssues: (config: CronConfig) => readonly RaisedIssue[] =
  raisedIssuesThrough(parseCronConfig);

const scheduled = (value: string): CronConfig => ({ runtime: 'node', schedule: value });

describe('cron', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: CronConfig = { runtime: 'node', schedule: '0 2 * * *' };
    const job = cron('nightly-report', config);

    expect(job.kind).toBe('cron');
    expect(job.name).toBe('nightly-report');
    expect(job.config).toBe(config);
  });

  it('exposes a handle that references its own name', () => {
    expect(
      cron('nightly-report', { runtime: 'node', schedule: '0 2 * * *' }).envVar('TOKEN'),
    ).toEqual({
      reference: 'fromService',
      name: 'nightly-report',
      origin: 'blueprint',
      type: 'cron',
      envVarKey: 'TOKEN',
    });
  });

  it('keeps the schedule verbatim', () => {
    expect(
      cron('nightly-report', { runtime: 'node', schedule: '*/5 * * * *' }).config.schedule,
    ).toBe('*/5 * * * *');
  });
});

describe('parseCronConfig', () => {
  it.each([
    '* * * * *',
    '0 0 * * *',
    '*/5 * * * *',
    '0 9-17 * * 1-5',
    '0 0 1,15 * *',
    '30 2 * * MON',
    '0 0 * JAN,jul *',
    '0 0 * * 7',
    '0-30/15 * * * *',
    '0  0 * *\t*',
  ])('accepts %j as a schedule', (value) => {
    expect(issueCodes(scheduled(value))).toEqual([]);
  });

  it.each([
    '',
    '* * * *',
    '* * * * * *',
    '@daily',
    '60 * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8',
    '* * ? * *',
    '0 0 L * *',
    '*/0 * * * *',
    '0 17-9 * * *',
    '0 0 * * everyday',
    '0 0 * * JAN',
    '0 0 * MON *',
  ])('refuses %j as a schedule', (value) => {
    expect(raisedIssues(scheduled(value))).toEqual([
      { validationCode: 'ScheduleNotCron', path: ['schedule'] },
    ]);
  });

  it('reports the schedule beside a type failure on another field', () => {
    const config = unchecked('{"runtime":"node","schedule":"@daily","plan":42}');

    expect(raisedIssues(config)).toEqual([
      { validationCode: 'ScheduleNotCron', path: ['schedule'] },
    ]);
    expect(issueCodes(config)).toHaveLength(2);
  });
});
