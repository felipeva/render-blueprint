import type { RootPreviews } from '../../blueprint/blueprint.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §11: a service that pins a branch builds it in every preview environment.
export const branchDisablesPreviews = (
  previews: RootPreviews | undefined,
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  if (previews === undefined || previews.generation === 'off') return [];

  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const branch = resource.config.branch;
    if (branch === undefined) continue;

    warnings.push({
      code: 'BranchDisablesPreviews',
      at: { resource: resource.name, field: 'branch' },
      message: `"${resource.name}" pins branch "${branch}" while root previews are on. Render builds that fixed branch in every preview environment instead of the branch the pull request opened.`,
    });
  }

  return warnings;
};
