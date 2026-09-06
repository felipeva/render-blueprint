import { describe, expectTypeOf, it } from "vitest";

import { web, type WebService } from "./web.js";

describe("web", () => {
  it("returns a WebService", () => {
    expectTypeOf(web("api", { runtime: "node" })).toEqualTypeOf<WebService>();
  });

  it("rejects a config field Render does not define", () => {
    // @ts-expect-error `nope` is not a WebConfig field.
    web("api", { runtime: "node", nope: true });
  });

  it("requires a runtime", () => {
    // @ts-expect-error `runtime` is the one required WebConfig field.
    web("api", {});
  });

  it("rejects a health check path without a leading slash", () => {
    // @ts-expect-error `healthCheckPath` is typed `/${string}`.
    web("api", { runtime: "node", healthCheckPath: "healthz" });
  });

  it("rejects a runtime outside the native set", () => {
    // @ts-expect-error `docker` is not a native runtime.
    web("api", { runtime: "docker" });
  });
});
