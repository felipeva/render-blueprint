import { describe, expect, it } from 'vitest';

import { cron, type CronConfig } from './cron.js';

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
