import { describe, expect, it } from 'vitest';

import { web } from '../../resources/web.js';
import { extraFieldConflict } from './extra-field-conflict.js';

describe('extraFieldConflict', () => {
  it('reports an escape-hatch key the library already emits', () => {
    const issues = extraFieldConflict([
      web('api', { runtime: 'node', extraFields: { name: 'renamed' } }),
    ]);

    expect(issues).toEqual([
      {
        code: 'ExtraFieldConflict',
        at: { resource: 'api', field: 'extraFields.name' },
        message: expect.stringContaining('name'),
      },
    ]);
  });

  it('reports one issue per colliding key', () => {
    const issues = extraFieldConflict([
      web('api', { runtime: 'node', extraFields: { runtime: 'go', envVars: [] } }),
    ]);

    expect(issues.map((issue) => issue.at.field)).toEqual([
      'extraFields.runtime',
      'extraFields.envVars',
    ]);
  });

  it('reports nothing for a modeled key that deprecatedField already claims', () => {
    expect(
      extraFieldConflict([web('api', { runtime: 'node', extraFields: { type: 'redis' } })]),
    ).toEqual([]);
  });

  it('reports nothing for a key the library does not model', () => {
    expect(
      extraFieldConflict([
        web('api', { runtime: 'node', extraFields: { maxShutdownDelaySeconds: 60 } }),
      ]),
    ).toEqual([]);
  });
});
