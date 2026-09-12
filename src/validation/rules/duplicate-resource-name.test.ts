import { describe, expect, it } from 'vitest';

import { keyValue } from '../../resources/key-value.js';
import { postgres, type PostgresConfig } from '../../resources/postgres.js';
import { readReplica, type ReadReplica } from '../../resources/read-replica.js';
import { web } from '../../resources/web.js';
import { duplicateResourceName } from './duplicate-resource-name.js';

// SAFETY: JSON.parse returns any. Every value below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const uncheckedDatabase: (json: string) => PostgresConfig = JSON.parse;
const uncheckedReplica: (json: string) => ReadReplica = JSON.parse;

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

  it('reads no name from read replica entries that did not parse', () => {
    const elephant = postgres(
      'elephant',
      uncheckedDatabase('{"readReplicas":["a","b","c","d","e","f"]}'),
    );

    expect(duplicateResourceName([elephant])).toEqual([]);
  });

  it('reads no name from a null read replica entry', () => {
    const elephant = postgres('elephant', {
      readReplicas: [uncheckedReplica('null'), uncheckedReplica('null')],
    });

    expect(duplicateResourceName([elephant])).toEqual([]);
  });

  it('reports two read replicas that share a name beside entries that did not parse', () => {
    const elephant = postgres('elephant', {
      readReplicas: [
        readReplica('elephant-replica'),
        uncheckedReplica('"a"'),
        readReplica('elephant-replica'),
        uncheckedReplica('"b"'),
      ],
    });

    expect(duplicateResourceName([elephant])).toEqual([
      {
        code: 'DuplicateResourceName',
        at: { resource: 'elephant', field: 'readReplicas' },
        message: expect.stringContaining('"elephant-replica"'),
      },
    ]);
  });

  it('reads no name from a read replica entry that did not parse beside one that did', () => {
    const elephant = postgres('elephant', {
      readReplicas: [
        readReplica('elephant-replica'),
        uncheckedReplica('{"name":"elephant-replica"}'),
      ],
    });

    expect(duplicateResourceName([elephant])).toEqual([]);
  });

  it('accepts a read replica whose name no other resource takes', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('elephant-replica')] });

    expect(duplicateResourceName([elephant, postgres('mammoth')])).toEqual([]);
  });

  it('holds a Key Value instance in the one namespace every kind shares', () => {
    const issues = duplicateResourceName([
      web('cache', { runtime: 'node' }),
      keyValue('cache', { ipAllowList: [] }),
    ]);

    expect(issues.map((issue) => issue.at)).toEqual([{ resource: 'cache', field: 'name' }]);
  });
});
