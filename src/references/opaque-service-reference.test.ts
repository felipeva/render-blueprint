import { describe, expect, it } from 'vitest';

import { opaqueServiceReference } from './opaque-service-reference.js';

describe('opaqueServiceReference', () => {
  it('reads a variable off the target by key', () => {
    expect(
      opaqueServiceReference({ name: 'jobs', type: 'worker', origin: 'blueprint' }).envVar('TOKEN'),
    ).toEqual({
      reference: 'fromService',
      name: 'jobs',
      origin: 'blueprint',
      type: 'worker',
      envVarKey: 'TOKEN',
    });
  });

  it('reads a variable Render provides', () => {
    expect(
      opaqueServiceReference({ name: 'jobs', type: 'cron', origin: 'blueprint' }).renderVar(
        'RENDER_SERVICE_NAME',
      ),
    ).toEqual({
      reference: 'fromService',
      name: 'jobs',
      origin: 'blueprint',
      type: 'cron',
      envVarKey: 'RENDER_SERVICE_NAME',
    });
  });
});
