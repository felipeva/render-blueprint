import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

export interface SecretValue {
  readonly sentinel: 'secret';
}

const valueSchema = z
  .strictObject(
    { sentinel: z.literal('secret') },
    { error: 'A secret is the value secret() returned; this value is not one.' },
  )
  .readonly();

type SecretValueSchemaMatchesInterface = Expect<Equal<z.infer<typeof valueSchema>, SecretValue>>;

export const SECRET_VALUE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies SecretValueSchemaMatchesInterface;

export const secretValueSchema: z.ZodType<SecretValue> = valueSchema;

export const secret = (): SecretValue => ({ sentinel: 'secret' });
