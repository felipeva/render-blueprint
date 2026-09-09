import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { envGroup } from '../../resources/env-group.js';
import type { IpAllowList } from '../../resources/ip-allow-list.js';
import { keyValue } from '../../resources/key-value.js';
import { postgres } from '../../resources/postgres.js';
import { web } from '../../resources/web.js';
import { persistenceNeedsPaidPlan } from './persistence-needs-paid-plan.js';

const ALLOW_LIST: IpAllowList = [{ source: '203.0.113.4/30' }];

describe('persistenceNeedsPaidPlan', () => {
  it('warns about a journalling policy on a free instance, naming the resource and the field', () => {
    const warnings = persistenceNeedsPaidPlan([
      keyValue('cache', {
        ipAllowList: ALLOW_LIST,
        plan: 'free',
        persistenceMode: 'journal-snapshot',
      }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'PersistenceNeedsPaidPlan',
        at: { resource: 'cache', field: 'persistenceMode' },
        message:
          '"cache" writes the plan "free" and the persistenceMode "journal-snapshot". Render documents data persistence as not available for a free instance and uses "off" there, so the mode names a policy the instance cannot keep.',
      },
    ]);
  });

  it('warns about a snapshot policy on a free instance', () => {
    const warnings = persistenceNeedsPaidPlan([
      keyValue('cache', { ipAllowList: ALLOW_LIST, plan: 'free', persistenceMode: 'snapshot' }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'cache', field: 'persistenceMode' },
    ]);
  });

  it('warns about nothing when a free instance turns persistence off', () => {
    expect(
      persistenceNeedsPaidPlan([
        keyValue('cache', { ipAllowList: ALLOW_LIST, plan: 'free', persistenceMode: 'off' }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when a free instance writes no mode, because no default is injected', () => {
    expect(
      persistenceNeedsPaidPlan([keyValue('cache', { ipAllowList: ALLOW_LIST, plan: 'free' })]),
    ).toEqual([]);
  });

  it('warns about nothing for a paid plan with any mode', () => {
    expect(
      persistenceNeedsPaidPlan([
        keyValue('cache', {
          ipAllowList: ALLOW_LIST,
          plan: 'starter',
          persistenceMode: 'journal-snapshot',
        }),
        keyValue('sessions', {
          ipAllowList: ALLOW_LIST,
          plan: '1g',
          persistenceMode: 'snapshot',
        }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when a mode sits beside no written plan', () => {
    expect(
      persistenceNeedsPaidPlan([
        keyValue('cache', { ipAllowList: ALLOW_LIST, persistenceMode: 'snapshot' }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for the kinds that carry no persistence mode', () => {
    expect(
      persistenceNeedsPaidPlan([
        web('api', { runtime: 'node', plan: 'free' }),
        cron('nightly', { runtime: 'node', schedule: '0 2 * * *' }),
        postgres('db'),
        envGroup('shared', { env: { LOG_LEVEL: 'info' } }),
      ]),
    ).toEqual([]);
  });

  it('warns about every free instance, never the first only', () => {
    const warnings = persistenceNeedsPaidPlan([
      keyValue('cache', { ipAllowList: ALLOW_LIST, plan: 'free', persistenceMode: 'snapshot' }),
      keyValue('sessions', {
        ipAllowList: ALLOW_LIST,
        plan: 'free',
        persistenceMode: 'journal-snapshot',
      }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['cache', 'sessions']);
  });
});
