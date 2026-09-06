import { describe, expect, it } from "vitest";

import { web } from "../../resources/web.js";
import { missingBuildCommand } from "./missing-build-command.js";

describe("missingBuildCommand", () => {
  it("warns about a native runtime with no build command", () => {
    const warnings = missingBuildCommand([web("api", { runtime: "node" })]);

    expect(warnings).toEqual([
      {
        code: "MissingBuildCommand",
        at: { resource: "api", field: "buildCommand" },
        message: expect.stringContaining("node"),
      },
    ]);
  });

  it("warns about nothing when the build command is set", () => {
    expect(
      missingBuildCommand([web("api", { runtime: "node", buildCommand: "pnpm build" })]),
    ).toEqual([]);
  });
});
