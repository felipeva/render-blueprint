import { describe, expect, it } from "vitest";

import { web, type WebConfig } from "./web.js";

describe("web", () => {
  it("returns an inert value carrying the kind, the name, and the config", () => {
    const config: WebConfig = { runtime: "node", buildCommand: "pnpm build" };

    expect(web("api", config)).toEqual({ kind: "web", name: "api", config });
  });

  it("emits the name verbatim", () => {
    expect(web("Legacy API", { runtime: "go" }).name).toBe("Legacy API");
  });
});
