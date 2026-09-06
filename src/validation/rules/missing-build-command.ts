import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

export const missingBuildCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources
    .filter((resource) => resource.config.buildCommand === undefined)
    .map((resource) => ({
      code: 'MissingBuildCommand',
      at: { resource: resource.name, field: 'buildCommand' },
      message: `"${resource.name}" runs on the "${resource.config.runtime}" runtime with no buildCommand. Render's documentation calls it required for every service it builds from source.`,
    }));
