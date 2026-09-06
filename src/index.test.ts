import { describe, expect, it } from "vitest";

import { packageName } from "./index.js";

describe("packageName", () => {
  it("names the npm package", () => {
    expect(packageName).toBe("render-blueprint");
  });
});
