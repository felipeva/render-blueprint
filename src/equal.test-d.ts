import { describe, expectTypeOf, it } from 'vitest';
import * as z from 'zod';

import { serverPlanSchema, type ServerPlan } from './enums/plan.js';
import { nativeRuntimeSchema, type NativeRuntime } from './enums/runtime.js';
import type { Equal, Expect } from './equal.js';

interface DriftReference {
  readonly runtime: NativeRuntime;
  readonly plan?: ServerPlan;
}

const baseSchema = z.strictObject({
  runtime: nativeRuntimeSchema,
  plan: serverPlanSchema.exactOptional(),
});

const matchingSchema = baseSchema.readonly();

const gainedSchema = baseSchema.extend({ replicas: z.number().exactOptional() }).readonly();

const lostSchema = baseSchema.omit({ plan: true }).readonly();

type Matching = z.infer<typeof matchingSchema>;
type Gained = z.infer<typeof gainedSchema>;
type Lost = z.infer<typeof lostSchema>;

describe('Equal', () => {
  it('holds when a schema and an interface declare the same fields', () => {
    expectTypeOf<Expect<Equal<Matching, DriftReference>>>().toEqualTypeOf<true>();
  });

  it('fails when the schema declares a field the interface does not', () => {
    // @ts-expect-error `replicas` is on the schema alone, so the guard is false.
    expectTypeOf<Expect<Equal<Gained, DriftReference>>>().toEqualTypeOf<true>();
  });

  it('fails when the interface declares a field the schema does not', () => {
    // @ts-expect-error `plan` is on the interface alone, so the guard is false.
    expectTypeOf<Expect<Equal<Lost, DriftReference>>>().toEqualTypeOf<true>();
  });
});
