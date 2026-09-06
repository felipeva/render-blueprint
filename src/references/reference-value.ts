import * as z from 'zod';

import { databasePropertySchema, type DatabaseProperty } from '../enums/database-property.js';
import type { Equal, Expect } from '../equal.js';

export interface DatabaseReferenceValue {
  readonly reference: 'fromDatabase';
  readonly name: string;
  readonly property: DatabaseProperty;
}

const referenceValueSchema = z
  .strictObject(
    {
      reference: z.literal('fromDatabase'),
      name: z.string(),
      property: databasePropertySchema,
    },
    {
      error: 'A database reference is the value a database handle produced; this value is not one.',
    },
  )
  .readonly();

type ReferenceValueSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof referenceValueSchema>, DatabaseReferenceValue>
>;

export const DATABASE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies ReferenceValueSchemaMatchesInterface;

export const databaseReferenceValueSchema: z.ZodType<DatabaseReferenceValue> = referenceValueSchema;
