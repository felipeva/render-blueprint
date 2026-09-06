import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

export const missingStartCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources
    .filter((resource) => resource.config.startCommand === undefined)
    .map((resource) => ({
      code: 'MissingStartCommand',
      at: { resource: resource.name, field: 'startCommand' },
      message: `"${resource.name}" runs on the "${resource.config.runtime}" runtime with no startCommand. Render's documentation calls it required for every service it builds from source.`,
    }));
