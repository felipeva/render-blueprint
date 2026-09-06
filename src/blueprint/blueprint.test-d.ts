import { describe, it } from "vitest";

import { blueprint } from "./blueprint.js";

describe("blueprint", () => {
  it("rejects a resource list entry that is not a resource", () => {
    // @ts-expect-error a bare string is not a BlueprintResource.
    blueprint({ resources: ["api"] });
  });
});
