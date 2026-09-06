import type { BlueprintResource } from "../../resources/resource.js";
import { WEB_SERVICE_FIELDS } from "../../resources/web.js";
import type { ValidationIssue } from "../issue.js";

const MODELED_FIELDS: ReadonlySet<string> = new Set<string>(WEB_SERVICE_FIELDS);

export const extraFieldConflict = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    for (const key of Object.keys(extraFields)) {
      if (MODELED_FIELDS.has(key)) {
        issues.push({
          code: "ExtraFieldConflict",
          at: { resource: resource.name, field: `extraFields.${key}` },
          message: `"${key}" is already modeled on a web service, so extraFields would overwrite what the library emits. Set it through the config instead.`,
        });
      }
    }
  }

  return issues;
};
