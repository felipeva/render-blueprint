import type { BlueprintResource } from '../../resources/resource.js';
import { deprecation, deprecationAdvice, deprecationScope } from '../deprecation.js';
import type { ValidationIssue } from '../issue.js';

export const deprecatedField = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    for (const [key, value] of Object.entries(extraFields)) {
      const retired = deprecation(key, value, deprecationScope(resource.kind));
      if (retired === undefined) continue;

      issues.push({
        code: 'DeprecatedField',
        at: { resource: resource.name, field: `extraFields.${key}` },
        message: deprecationAdvice(retired),
      });
    }
  }

  return issues;
};
