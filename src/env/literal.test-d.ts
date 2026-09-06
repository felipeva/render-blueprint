import { describe, expectTypeOf, it } from 'vitest';

import { literal, LITERAL_VALUE_SCHEMA_MATCHES_INTERFACE, type LiteralValue } from './literal.js';

describe('literal', () => {
  it('returns a LiteralValue', () => {
    expectTypeOf(literal('info')).toEqualTypeOf<LiteralValue>();
  });

  it('takes a number as readily as a string', () => {
    expectTypeOf(literal(8080, { previewValue: 3000 })).toEqualTypeOf<LiteralValue>();
  });

  it('rejects a boolean value, which Render has no env var form for', () => {
    // @ts-expect-error spec §6.1 gives value a string or a number.
    literal(true);
  });

  it('rejects a boolean preview value', () => {
    // @ts-expect-error spec §6.1 gives previewValue a string or a number.
    literal('json', { previewValue: true });
  });

  it('rejects an option Render does not define', () => {
    // @ts-expect-error `previewValue` is the one LiteralOptions field.
    literal('json', { previewPlan: 'starter' });
  });
});

describe('LITERAL_VALUE_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(LITERAL_VALUE_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
