import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';

export const duplicateResourceName = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const names = new Set<string>();
  const values = new Set<BlueprintResource>();
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    if (values.has(resource)) continue;
    values.add(resource);

    if (names.has(resource.name)) {
      issues.push({
        code: 'DuplicateResourceName',
        at: { resource: resource.name, field: 'name' },
        message: `More than one resource is named "${resource.name}". Render identifies a resource by its name, so every name in a blueprint must be unique.`,
      });
    }
    names.add(resource.name);
  }

  return issues;
};
