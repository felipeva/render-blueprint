import type { PlacedResource } from '../../blueprint/placement.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';

export const resourceInMultipleLocations = (
  placed: readonly PlacedResource[],
): readonly ValidationIssue[] => {
  const first = new Map<BlueprintResource, string>();
  const issues: ValidationIssue[] = [];

  for (const entry of placed) {
    const earlier = first.get(entry.resource);

    if (earlier === undefined) {
      first.set(entry.resource, entry.location);
      continue;
    }

    issues.push({
      code: 'ResourceInMultipleLocations',
      at: { resource: entry.resource.name, field: 'placement' },
      message:
        earlier === entry.location
          ? `"${entry.resource.name}" is placed twice in ${earlier}. Render requires every resource to be defined in exactly one location.`
          : `"${entry.resource.name}" is placed in ${earlier} and again in ${entry.location}. Render requires every resource to be defined in exactly one location.`,
    });
  }

  return issues;
};
