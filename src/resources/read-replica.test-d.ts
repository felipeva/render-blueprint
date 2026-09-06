import { describe, expectTypeOf, it } from 'vitest';

import {
  readReplica,
  READ_REPLICA_SCHEMA_MATCHES_INTERFACE,
  type ReadReplica,
} from './read-replica.js';

describe('readReplica', () => {
  it('returns a ReadReplica', () => {
    expectTypeOf(readReplica('elephant-replica')).toEqualTypeOf<ReadReplica>();
  });

  it('rejects a property the handle does not carry', () => {
    // @ts-expect-error `hostport` belongs to a service handle, never a database one.
    expectTypeOf(readReplica('elephant-replica').hostport).toBeUnknown();
  });
});

describe('READ_REPLICA_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(READ_REPLICA_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
