import { describe, expectTypeOf, it } from "vitest";

import { packageName } from "./index.js";

describe("packageName", () => {
  it("is the literal package name, not a widened string", () => {
    expectTypeOf(packageName).toEqualTypeOf<"render-blueprint">();
  });
});
