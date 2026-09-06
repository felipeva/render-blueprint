import { describe, expect, it } from 'vitest';

import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import type { Scaling } from '../../resources/scaling.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { instancesIgnoredByScaling } from './instances-ignored-by-scaling.js';

const SCALING: Scaling = { minInstances: 1, maxInstances: 4, targetCPUPercent: 70 };

describe('instancesIgnoredByScaling', () => {
  it('warns about an instance count a web service sets beside autoscaling', () => {
    const warnings = instancesIgnoredByScaling([
      web('api', { runtime: 'node', instances: 3, scaling: SCALING }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'InstancesIgnoredByScaling',
        at: { resource: 'api', field: 'instances' },
        message: expect.stringContaining('autoscales'),
      },
    ]);
  });

  it('warns about every server kind that sets both', () => {
    const warnings = instancesIgnoredByScaling([
      web('api', { runtime: 'node', instances: 2, scaling: SCALING }),
      privateService('auth', { runtime: 'node', instances: 2, scaling: SCALING }),
      worker('jobs', { runtime: 'node', instances: 2, scaling: SCALING }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['api', 'auth', 'jobs']);
  });

  it('warns about nothing when the service sets one of the two', () => {
    expect(
      instancesIgnoredByScaling([
        web('api', { runtime: 'node', instances: 3 }),
        worker('jobs', { runtime: 'node', scaling: SCALING }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a kind that carries neither field', () => {
    expect(
      instancesIgnoredByScaling([cron('nightly', { runtime: 'node', schedule: '0 2 * * *' })]),
    ).toEqual([]);
  });
});
