import { describe, expect, it } from 'vitest';

import { readReplica } from './read-replica.js';

describe('readReplica', () => {
  it('returns an inert value carrying its kind and its name', () => {
    const replica = readReplica('elephant-replica');

    expect(replica.kind).toBe('readReplica');
    expect(replica.name).toBe('elephant-replica');
  });

  it('references its own name, because Render addresses a replica by it', () => {
    expect(readReplica('elephant-replica').connectionString).toEqual({
      reference: 'fromDatabase',
      name: 'elephant-replica',
      origin: 'blueprint',
      property: 'connectionString',
    });
  });
});
