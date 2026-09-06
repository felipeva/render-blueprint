import type { Result as ResultType } from "better-result";
import { describe, expectTypeOf, it } from "vitest";

import {
  blueprint,
  synthesize,
  validate,
  type BlueprintInvalid,
  type SynthesisReport,
  type ValidatedBlueprint,
} from "./index.js";

describe("synthesize", () => {
  it("names exactly BlueprintInvalid in its error lane at the public entry", () => {
    expectTypeOf(synthesize(blueprint({}))).toEqualTypeOf<
      ResultType<SynthesisReport, BlueprintInvalid>
    >();
  });
});

describe("validate", () => {
  it("names exactly BlueprintInvalid in its error lane at the public entry", () => {
    expectTypeOf(validate(blueprint({}))).toEqualTypeOf<
      ResultType<ValidatedBlueprint, BlueprintInvalid>
    >();
  });
});
