import * as z from 'zod';

import { databasePropertySchema, type DatabaseProperty } from '../enums/database-property.js';
import {
  referenceableServiceTypeSchema,
  type ReferenceableServiceType,
} from '../enums/referenceable-service-type.js';
import { servicePropertySchema, type ServiceProperty } from '../enums/service-property.js';
import type { Equal, Expect } from '../equal.js';
import { referenceOriginSchema, type ReferenceOrigin } from './reference-origin.js';

export interface DatabaseReferenceValue {
  readonly reference: 'fromDatabase';
  readonly name: string;
  readonly origin: ReferenceOrigin;
  readonly property: DatabaseProperty;
}

export interface ServicePropertyReferenceValue {
  readonly reference: 'fromService';
  readonly name: string;
  readonly origin: ReferenceOrigin;
  readonly type: ReferenceableServiceType;
  readonly property: ServiceProperty;
}

export interface ServiceEnvVarReferenceValue {
  readonly reference: 'fromService';
  readonly name: string;
  readonly origin: ReferenceOrigin;
  readonly type: ReferenceableServiceType;
  readonly envVarKey: string;
}

// spec §6.1 c: Render's schema allows property and envVarKey together; a handle yields one or the
// other, and the two-member union is what makes the pair unrepresentable.
export type ServiceReferenceValue = ServicePropertyReferenceValue | ServiceEnvVarReferenceValue;

const referenceValueSchema = z
  .strictObject(
    {
      reference: z.literal('fromDatabase'),
      name: z.string(),
      origin: referenceOriginSchema,
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

const serviceValueSchema = z.union(
  [
    z
      .strictObject({
        reference: z.literal('fromService'),
        name: z.string(),
        origin: referenceOriginSchema,
        type: referenceableServiceTypeSchema,
        property: servicePropertySchema,
      })
      .readonly(),
    z
      .strictObject({
        reference: z.literal('fromService'),
        name: z.string(),
        origin: referenceOriginSchema,
        type: referenceableServiceTypeSchema,
        envVarKey: z.string(),
      })
      .readonly(),
  ],
  { error: 'A service reference is the value a service handle produced; this value is not one.' },
);

type ServiceValueSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof serviceValueSchema>, ServiceReferenceValue>
>;

export const SERVICE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies ServiceValueSchemaMatchesInterface;

export const serviceReferenceValueSchema: z.ZodType<ServiceReferenceValue> = serviceValueSchema;
