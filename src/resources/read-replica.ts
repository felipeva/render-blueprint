import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';
import { postgresReference, type PostgresReference } from '../references/postgres-reference.js';
import { databaseReferenceValueSchema } from '../references/reference-value.js';

export interface ReadReplica extends PostgresReference {
  readonly kind: 'readReplica';
  readonly name: string;
}

// Emission order follows the schema's readReplica property order.
export const READ_REPLICA_FIELDS = ['name'] as const;

const replicaSchema = z
  .strictObject(
    {
      kind: z.literal('readReplica'),
      name: z.string(),
      connectionString: databaseReferenceValueSchema,
      connectionPoolString: databaseReferenceValueSchema,
      host: databaseReferenceValueSchema,
      port: databaseReferenceValueSchema,
      user: databaseReferenceValueSchema,
      password: databaseReferenceValueSchema,
      database: databaseReferenceValueSchema,
    },
    { error: 'A read replica is the value readReplica(name) returned; this entry is not one.' },
  )
  .readonly();

type ReplicaSchemaMatchesInterface = Expect<Equal<z.infer<typeof replicaSchema>, ReadReplica>>;

export const READ_REPLICA_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies ReplicaSchemaMatchesInterface;

export const readReplicaSchema: z.ZodType<ReadReplica> = replicaSchema;

export const readReplica = (name: string): ReadReplica => ({
  kind: 'readReplica',
  name,
  ...postgresReference(name, 'blueprint'),
});
