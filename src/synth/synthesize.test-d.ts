import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import type { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import { synthesize, type SynthesisReport } from './synthesize.js';

describe('synthesize', () => {
  it('names exactly BlueprintInvalid in its error lane', () => {
    expectTypeOf(synthesize(blueprint({}))).toEqualTypeOf<
      ResultType<SynthesisReport, BlueprintInvalid>
    >();
  });
});
