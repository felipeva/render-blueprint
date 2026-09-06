import { describe, expect, it } from 'vitest';

import { envGroup } from '../../resources/env-group.js';
import { web } from '../../resources/web.js';
import { duplicateEnvKey } from './duplicate-env-key.js';

const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info' } });

const regional = envGroup('regional', { env: { LOG_LEVEL: 'debug' } });

describe('duplicateEnvKey', () => {
  it('reports a key that reaches a service from two imported groups', () => {
    const issues = duplicateEnvKey([
      web('api', { runtime: 'node', envGroups: [settings, regional] }),
    ]);

    expect(issues).toEqual([
      {
        code: 'DuplicateEnvKey',
        at: { resource: 'api', field: 'env.LOG_LEVEL' },
        message: expect.stringContaining('groups "shared-settings" and "regional"'),
      },
    ]);
  });

  it('reports nothing for a key one imported group carries', () => {
    expect(duplicateEnvKey([web('api', { runtime: 'node', envGroups: [settings] })])).toEqual([]);
  });

  it('reports nothing for a group imported twice, which imports one set of values', () => {
    expect(
      duplicateEnvKey([web('api', { runtime: 'node', envGroups: [settings, settings] })]),
    ).toEqual([]);
  });

  it('leaves a key the service also sets directly to the collision rule', () => {
    expect(
      duplicateEnvKey([
        web('api', {
          runtime: 'node',
          env: { LOG_LEVEL: 'warn' },
          envGroups: [settings, regional],
        }),
      ]),
    ).toEqual([]);
  });

  it('reports nothing for an environment map, whose keys are unique by construction', () => {
    expect(
      duplicateEnvKey([
        web('api', { runtime: 'node', env: { NODE_ENV: 'production', PORT: 8080 } }),
      ]),
    ).toEqual([]);
  });

  it('reports nothing for a resource with no environment map', () => {
    expect(duplicateEnvKey([web('api', { runtime: 'node' })])).toEqual([]);
  });
});
