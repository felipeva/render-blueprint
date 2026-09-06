import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

export interface GeneratedValue {
  readonly sentinel: 'generated';
}

const valueSchema = z
  .strictObject(
    { sentinel: z.literal('generated') },
    { error: 'A generated value is the value generated() returned; this value is not one.' },
  )
  .readonly();

type GeneratedValueSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof valueSchema>, GeneratedValue>
>;

export const GENERATED_VALUE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies GeneratedValueSchemaMatchesInterface;

export const generatedValueSchema: z.ZodType<GeneratedValue> = valueSchema;

export const generated = (): GeneratedValue => ({ sentinel: 'generated' });
