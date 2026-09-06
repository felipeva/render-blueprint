import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import { blueprint, synthesize, type BlueprintInvalid, type SynthesisReport } from './index.js';

describe('synthesize', () => {
  it('names exactly BlueprintInvalid in its error lane at the public entry', () => {
    expectTypeOf(synthesize(blueprint({}))).toEqualTypeOf<
      ResultType<SynthesisReport, BlueprintInvalid>
    >();
  });
});
