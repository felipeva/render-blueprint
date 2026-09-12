import { describe, expect, it } from 'vitest';

import { postgres, type PostgresConfig } from '../resources/postgres.js';
import { readReplica, type ReadReplica } from '../resources/read-replica.js';
import { web } from '../resources/web.js';
import { declaresUnparsedReplica, replicaNames } from './replica-names.js';

// SAFETY: JSON.parse returns any. Every value below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const uncheckedDatabase: (json: string) => PostgresConfig = JSON.parse;
const uncheckedReplica: (json: string) => ReadReplica = JSON.parse;

const withUnknownField = { ...readReplica('elephant-standby'), region: 'oregon' };

describe('replicaNames', () => {
  it('reads the name of every read replica entry, in declaration order', () => {
    const elephant = postgres('elephant', {
      readReplicas: [readReplica('elephant-replica'), readReplica('elephant-reader')],
    });

    expect(replicaNames(elephant)).toEqual(['elephant-replica', 'elephant-reader']);
  });

  it('reads no name from an entry that did not parse, beside one that did', () => {
    const elephant = postgres('elephant', {
      readReplicas: [
        uncheckedReplica('null'),
        uncheckedReplica('"elephant-reader"'),
        uncheckedReplica('{"name":"elephant-standby"}'),
        withUnknownField,
        readReplica('elephant-replica'),
      ],
    });

    expect(replicaNames(elephant)).toEqual(['elephant-replica']);
  });

  it('reads no name from a readReplicas value that is not an array', () => {
    const elephant = postgres('elephant', uncheckedDatabase('{"readReplicas":"elephant-replica"}'));

    expect(replicaNames(elephant)).toEqual([]);
  });

  it('reads no name from a database that declares no read replica', () => {
    expect(replicaNames(postgres('elephant'))).toEqual([]);
  });

  it('reads no name from a resource that is not a database', () => {
    expect(replicaNames(web('api', { runtime: 'node' }))).toEqual([]);
  });
});

describe('declaresUnparsedReplica', () => {
  it('is false when every read replica entry parsed', () => {
    const elephant = postgres('elephant', { readReplicas: [readReplica('elephant-replica')] });

    expect(declaresUnparsedReplica(elephant)).toBe(false);
  });

  it('is false for a database that declares no read replica', () => {
    expect(declaresUnparsedReplica(postgres('elephant'))).toBe(false);
    expect(declaresUnparsedReplica(postgres('elephant', { readReplicas: [] }))).toBe(false);
  });

  it('is false for a resource that is not a database', () => {
    expect(declaresUnparsedReplica(web('api', { runtime: 'node' }))).toBe(false);
  });

  it('is true for an entry that is not an object', () => {
    const nulled = postgres('elephant', { readReplicas: [uncheckedReplica('null')] });
    const bare = postgres('elephant', { readReplicas: [uncheckedReplica('"elephant-replica"')] });

    expect(declaresUnparsedReplica(nulled)).toBe(true);
    expect(declaresUnparsedReplica(bare)).toBe(true);
  });

  it('is true for an entry that carries a name but is not a read replica', () => {
    const elephant = postgres('elephant', {
      readReplicas: [
        readReplica('elephant-replica'),
        uncheckedReplica('{"name":"elephant-reader"}'),
      ],
    });

    expect(declaresUnparsedReplica(elephant)).toBe(true);
  });

  it('is true for a read replica that carries a field the schema does not model', () => {
    const elephant = postgres('elephant', { readReplicas: [withUnknownField] });

    expect(declaresUnparsedReplica(elephant)).toBe(true);
  });

  it('is true for a hole in the readReplicas array, which the schema reads as a missing entry', () => {
    const entries: ReadReplica[] = [readReplica('elephant-replica')];
    entries.length = 2;

    expect(declaresUnparsedReplica(postgres('elephant', { readReplicas: entries }))).toBe(true);
  });

  it('is true for a readReplicas value that is not an array', () => {
    const named = postgres('elephant', uncheckedDatabase('{"readReplicas":"elephant-replica"}'));
    const nulled = postgres('elephant', uncheckedDatabase('{"readReplicas":null}'));

    expect(declaresUnparsedReplica(named)).toBe(true);
    expect(declaresUnparsedReplica(nulled)).toBe(true);
  });
});
