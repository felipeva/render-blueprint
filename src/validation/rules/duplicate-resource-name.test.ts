import { describe, expect, it } from 'vitest';

import { postgres } from '../../resources/postgres.js';
import { readReplica } from '../../resources/read-replica.js';
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
  it('reports nothing for one resource value flattened out of two placements', () => {
    const api = web('api', { runtime: 'node' });

    expect(duplicateResourceName([api, api])).toEqual([]);
  });

  it('reports a read replica that takes the name of a listed database', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('mammoth')] });

    expect(duplicateResourceName([postgres('mammoth'), elephant])).toEqual([
      {
        code: 'DuplicateResourceName',
        at: { resource: 'elephant', field: 'readReplicas' },
        message:
          'The read replica "mammoth" on "elephant" takes a name another resource already takes. Render addresses a replica by its own name, so replicas and resources share one namespace.',
      },
    ]);
  });

  it('reports two read replicas that take the same name', () => {
    const elephant = postgres('elephant', {
      readReplicas: [readReplica('elephant-replica'), readReplica('elephant-replica')],
    });

    expect(duplicateResourceName([elephant]).map((issue) => issue.at)).toEqual([
      { resource: 'elephant', field: 'readReplicas' },
    ]);
  });

  it('accepts a read replica whose name no other resource takes', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('elephant-replica')] });

    expect(duplicateResourceName([elephant, postgres('mammoth')])).toEqual([]);
  });
});
