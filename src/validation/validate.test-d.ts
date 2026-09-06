import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import type { BlueprintInvalid } from './blueprint-invalid.js';
import { validate, type ValidatedBlueprint } from './validate.js';

describe('validate', () => {
  it('names exactly BlueprintInvalid in its error lane', () => {
    expectTypeOf(validate(blueprint({}))).toEqualTypeOf<
      ResultType<ValidatedBlueprint, BlueprintInvalid>
    >();
  });
});
