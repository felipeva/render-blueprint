import type { BlueprintResource } from "../../resources/resource.js";
import type { ValidationIssue } from "../issue.js";

const REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ["env", "runtime"],
  ["autoDeploy", "autoDeployTrigger"],
  ["previewsEnabled", "previews.generation"],
  ["pullRequestPreviewsEnabled", "previews.generation"],
  ["previewPlan", "previews.plan"],
]);

export const deprecatedField = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    for (const [key, value] of Object.entries(extraFields)) {
      const replacement = REPLACEMENTS.get(key);
      if (replacement !== undefined) {
        issues.push({
          code: "DeprecatedField",
          at: { resource: resource.name, field: `extraFields.${key}` },
          message: `Render deprecated "${key}"; use "${replacement}". The escape hatch never emits a retired form.`,
        });
      }
      if (key === "type" && value === "redis") {
        issues.push({
          code: "DeprecatedField",
          at: { resource: resource.name, field: "extraFields.type" },
          message: `Render deprecated the service type "redis"; use "keyvalue". The escape hatch never emits a retired form.`,
        });
      }
    }
  }

  return issues;
};
