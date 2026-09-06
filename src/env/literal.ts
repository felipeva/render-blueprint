import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

export interface LiteralOptions {
  readonly previewValue?: string | number;
}

export interface LiteralValue {
  readonly sentinel: 'literal';
  readonly value: string | number;
  readonly previewValue?: string | number;
}

// spec §6.1: value and previewValue are each a string or a number.
const plainValueSchema = z.union([z.string(), z.number()]);

const valueSchema = z
  .strictObject(
    {
      sentinel: z.literal('literal'),
      value: plainValueSchema,
      previewValue: plainValueSchema.exactOptional(),
    },
    { error: 'A literal is the value literal(value, options) returned; this value is not one.' },
  )
  .readonly();

type LiteralValueSchemaMatchesInterface = Expect<Equal<z.infer<typeof valueSchema>, LiteralValue>>;

export const LITERAL_VALUE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies LiteralValueSchemaMatchesInterface;

export const literalValueSchema: z.ZodType<LiteralValue> = valueSchema;

export const literal = (value: string | number, options?: LiteralOptions): LiteralValue =>
  options?.previewValue === undefined
    ? { sentinel: 'literal', value }
    : { sentinel: 'literal', value, previewValue: options.previewValue };
