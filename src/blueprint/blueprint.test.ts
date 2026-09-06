import { describe, expect, it } from "vitest";

import { web } from "../resources/web.js";
import { blueprint } from "./blueprint.js";

describe("blueprint", () => {
  it("keeps the resource list in declaration order", () => {
    const api = web("api", { runtime: "node" });
    const admin = web("admin", { runtime: "node" });

    expect(blueprint({ resources: [api, admin] }).resources).toEqual([api, admin]);
  });

  it("treats an omitted resource list as empty", () => {
    expect(blueprint({}).resources).toEqual([]);
  });
});
