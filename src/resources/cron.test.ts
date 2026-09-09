import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { cron, parseCronConfig, type CronConfig } from './cron.js';

// SAFETY: JSON.parse returns any. The config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => CronConfig = JSON.parse;

interface ParsedIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

const issueCodes = (config: CronConfig): readonly string[] => {
  const result = parseCronConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

const parsedIssues = (config: CronConfig): readonly ParsedIssue[] => {
  const result = parseCronConfig(config);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({ code: String(issue.code), path: issue.path }));
};

const issueMessages = (config: CronConfig): readonly string[] => {
  const result = parseCronConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
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
  it.each(['0 2 * * *', '*/5 * * * *', '0 0 * * MON'])('accepts %j as a schedule', (value) => {
    expect(issueCodes(scheduled(value))).toEqual([]);
  });

  it.each(['@daily', '60 * * * *', '0 17-9 * * *'])(
    'refuses %j at the schedule under its own code',
    (value) => {
      expect(raisedIssues(scheduled(value))).toEqual([
        { validationCode: 'ScheduleNotCron', path: ['schedule'] },
      ]);
    },
  );

  it('refuses the empty schedule under the grammar rather than a length rule', () => {
    expect(issueCodes(scheduled(''))).toEqual(['custom']);
    expect(raisedIssues(scheduled(''))).toEqual([
      { validationCode: 'ScheduleNotCron', path: ['schedule'] },
    ]);
  });

  it('names the five-field form and the value in the message', () => {
    expect(issueMessages(scheduled('@daily'))).toEqual([
      'A schedule is a cron expression of five fields — minute, hour, day of month, month and day of week, as in "0 2 * * *" — and "@daily" is not one.',
    ]);
  });

  it('reports the schedule beside a type failure on another field', () => {
    const config = unchecked('{"runtime":"node","schedule":"@daily","plan":42}');

    expect(parsedIssues(config)).toEqual([
      { code: 'custom', path: ['schedule'] },
      { code: 'invalid_value', path: ['plan'] },
    ]);
    expect(raisedIssues(config)).toEqual([
      { validationCode: 'ScheduleNotCron', path: ['schedule'] },
    ]);
  });
});
