import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.1: paths and ignoredPaths are globs relative to the repository root.
// INFERRED: no Render document says what a build filter does on a service built from a prebuilt
// image.
const filtersAnImage = (resource: BlueprintResource): boolean => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
      return resource.config.runtime === 'image' && resource.config.buildFilter !== undefined;
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return false;
  }
};

export const buildFilterOnImageSource = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] =>
    filtersAnImage(resource)
      ? [
          {
            code: 'BuildFilterOnImageSource',
            at: { resource: resource.name, field: 'buildFilter' },
            message: `"${resource.name}" runs a prebuilt image and sets a buildFilter. A build filter's globs are read relative to a repository root, and the service names no repository of its own to read them against, so whether a sync stores the filter, ignores it, or rejects it is unstated.`,
          },
        ]
      : [],
  );
