import type { BlueprintResource } from '../../resources/resource.js';
import { deprecation } from '../deprecation.js';
import type { ValidationIssue } from '../issue.js';

export const deprecatedField = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    for (const [key, value] of Object.entries(extraFields)) {
      const retired = deprecation(key, value);
      if (retired === undefined) continue;

      issues.push({
        code: 'DeprecatedField',
        at: { resource: resource.name, field: `extraFields.${key}` },
        message:
          key === 'type'
            ? `Render deprecated the service type "redis"; use "${retired.replacement}". The escape hatch never emits a retired form.`
            : `Render deprecated "${key}"; use "${retired.replacement}". The escape hatch never emits a retired form.`,
      });
    }
  }

  return issues;
};
