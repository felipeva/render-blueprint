import { describe, expect, it } from 'vitest';

import { envGroup } from '../../resources/env-group.js';
import { web } from '../../resources/web.js';
import { envKeyCollision } from './env-key-collision.js';

const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info' } });

const regional = envGroup('regional', { env: { LOG_LEVEL: 'debug' } });

describe('envKeyCollision', () => {
  it('reports a key a service sets directly and imports through a group', () => {
    const issues = envKeyCollision([
      web('api', { runtime: 'node', env: { LOG_LEVEL: 'warn' }, envGroups: [settings] }),
    ]);

    expect(issues).toEqual([
      {
        code: 'EnvKeyCollision',
        at: { resource: 'api', field: 'env.LOG_LEVEL' },
        message: expect.stringContaining('shared-settings'),
      },
    ]);
  });

  it('names every group carrying the key it reports', () => {
    const [issue] = envKeyCollision([
      web('api', { runtime: 'node', env: { LOG_LEVEL: 'warn' }, envGroups: [settings, regional] }),
    ]);

    expect(issue?.message).toContain('groups "shared-settings" and "regional"');
  });

  it('reports nothing when the imported keys and the declared keys are disjoint', () => {
    expect(
      envKeyCollision([
        web('api', { runtime: 'node', env: { NODE_ENV: 'production' }, envGroups: [settings] }),
      ]),
    ).toEqual([]);
  });

  it('reports nothing for a service that imports no group', () => {
    expect(envKeyCollision([web('api', { runtime: 'node', env: { LOG_LEVEL: 'warn' } })])).toEqual(
      [],
    );
  });
});
