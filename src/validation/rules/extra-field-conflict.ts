import { modeledFields, type BlueprintResource } from '../../resources/resource.js';
import { deprecation } from '../deprecation.js';
import type { ValidationIssue } from '../issue.js';

export const extraFieldConflict = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    const modeled = new Set<string>(modeledFields(resource));

    for (const [key, value] of Object.entries(extraFields)) {
      if (!modeled.has(key) || deprecation(key, value) !== undefined) continue;

      issues.push({
        code: 'ExtraFieldConflict',
        at: { resource: resource.name, field: `extraFields.${key}` },
        message: `The library already emits "${key}" for "${resource.name}", so extraFields would overwrite it. Set it through the config instead.`,
      });
    }
  }

  return issues;
};
