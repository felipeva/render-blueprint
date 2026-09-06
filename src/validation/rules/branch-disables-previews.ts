import type { RootPreviews } from '../../blueprint/blueprint.js';
import type { BlueprintResource } from '../../resources/resource.js';
import { repoSource } from '../../resources/service-source.js';
import type { ValidationWarning } from '../issue.js';

// spec §9 and §5: a database has no repo, a Key Value instance has none, and spec §6.1 gives a
// group none either, so no branch pins one. A prebuilt image names no branch to pin.
const branchOf = (resource: BlueprintResource): string | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
      return repoSource(resource.config)?.branch;
    case 'staticSite':
      return resource.config.branch;
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

// spec §11: a service that pins a branch builds it in every preview environment.
export const branchDisablesPreviews = (
  previews: RootPreviews | undefined,
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  if (previews === undefined || previews.generation === 'off') return [];

  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const branch = branchOf(resource);
    if (branch === undefined) continue;

    warnings.push({
      code: 'BranchDisablesPreviews',
      at: { resource: resource.name, field: 'branch' },
      message: `"${resource.name}" pins branch "${branch}" while root previews are on. Render builds that fixed branch in every preview environment instead of the branch the pull request opened.`,
    });
  }

  return warnings;
};
