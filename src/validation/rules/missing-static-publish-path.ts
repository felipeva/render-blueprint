import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.7: the spec calls staticPublishPath required; the schema leaves it out of `required`.
export const missingStaticPublishPath = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources
    .filter((resource) => resource.kind === 'staticSite')
    .filter((resource) => resource.config.staticPublishPath === undefined)
    .map((resource) => ({
      code: 'MissingStaticPublishPath',
      at: { resource: resource.name, field: 'staticPublishPath' },
      message: `"${resource.name}" is a static site with no staticPublishPath. Render publishes the directory the build wrote, and its documentation calls the field required.`,
    }));
