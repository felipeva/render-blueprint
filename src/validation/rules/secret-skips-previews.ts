import type { RootPreviews } from '../../blueprint/blueprint.js';
import { resolveEnv } from '../../env/resolve-env.js';
import { resourceEnv, type BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// Root previews are the only preview switch the library models today.
const previewsAreOn = (previews: RootPreviews | undefined): boolean =>
  previews !== undefined && previews.generation !== 'off';

// spec §6.3: Render never copies a sync: false variable into a preview environment.
export const secretSkipsPreviews = (
  previews: RootPreviews | undefined,
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  if (!previewsAreOn(previews)) return [];

  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    for (const entry of resolveEnv(resourceEnv(resource), undefined)) {
      if (entry.form !== 'secret') continue;

      warnings.push({
        code: 'SecretSkipsPreviews',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" sets "${entry.key}" with secret() while previews are on. Render does not copy a sync: false variable into a preview environment, so declare it in an environment group the Dashboard manages instead.`,
      });
    }
  }

  return warnings;
};
