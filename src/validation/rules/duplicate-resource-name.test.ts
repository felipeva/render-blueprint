import { describe, expect, it } from 'vitest';

import { web } from '../../resources/web.js';
import { duplicateResourceName } from './duplicate-resource-name.js';

describe('duplicateResourceName', () => {
  it('reports a name declared by two resources', () => {
    const issues = duplicateResourceName([
      web('api', { runtime: 'node' }),
      web('api', { runtime: 'go' }),
    ]);

    expect(issues).toEqual([
      {
        code: 'DuplicateResourceName',
        at: { resource: 'api', field: 'name' },
        message: expect.stringContaining('api'),
      },
    ]);
  });

  it('reports one issue per repeat, not one per resource sharing the name', () => {
    const issues = duplicateResourceName([
      web('api', { runtime: 'node' }),
      web('api', { runtime: 'go' }),
      web('api', { runtime: 'rust' }),
    ]);

    expect(issues).toHaveLength(2);
  });

  it('reports nothing when every name is unique', () => {
    expect(
      duplicateResourceName([web('api', { runtime: 'node' }), web('admin', { runtime: 'node' })]),
    ).toEqual([]);
  });
});
