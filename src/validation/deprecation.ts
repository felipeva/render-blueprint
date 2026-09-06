import type { JsonValue } from "../json.js";

export interface Deprecation {
  readonly key: string;
  readonly replacement: string;
}

const REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ["env", "runtime"],
  ["autoDeploy", "autoDeployTrigger"],
  ["previewsEnabled", "previews.generation"],
  ["pullRequestPreviewsEnabled", "previews.generation"],
  ["previewPlan", "previews.plan"],
]);

/** The deprecation a service field name and value carry, if Render has retired that form. */
export const deprecation = (key: string, value: JsonValue): Deprecation | undefined => {
  const replacement = REPLACEMENTS.get(key);
  if (replacement !== undefined) return { key, replacement };
  return key === "type" && value === "redis" ? { key, replacement: "keyvalue" } : undefined;
};
