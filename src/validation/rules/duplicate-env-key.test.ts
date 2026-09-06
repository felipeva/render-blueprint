import { describe, expect, it } from "vitest";

import { web } from "../../resources/web.js";
import { duplicateEnvKey } from "./duplicate-env-key.js";

describe("duplicateEnvKey", () => {
  it("reports nothing for an environment map, whose keys are unique by construction", () => {
    expect(
      duplicateEnvKey([
        web("api", { runtime: "node", env: { NODE_ENV: "production", PORT: 8080 } }),
      ]),
    ).toEqual([]);
  });

  it("reports nothing for a resource with no environment map", () => {
    expect(duplicateEnvKey([web("api", { runtime: "node" })])).toEqual([]);
  });
});
