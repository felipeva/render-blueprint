import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

const runtime = (resource: BlueprintResource): string => {
  switch (resource.kind) {
    case 'web':
      return resource.config.runtime;
    case 'staticSite':
      return 'static';
  }
};

export const missingBuildCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources
    .filter((resource) => resource.config.buildCommand === undefined)
    .map((resource) => ({
      code: 'MissingBuildCommand',
      at: { resource: resource.name, field: 'buildCommand' },
      message: `"${resource.name}" runs on the "${runtime(resource)}" runtime with no buildCommand. Render's documentation calls it required for every service it builds from source.`,
    }));
