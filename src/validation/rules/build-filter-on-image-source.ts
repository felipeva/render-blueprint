import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.1: paths and ignoredPaths are globs relative to the repository root. spec §4.8: the four
// kinds below are the ones whose schema branch carries a build filter and an image source at once.
//
// INFERRED: no Render document says what a build filter does on a service built from a prebuilt
// image. The service names no repository of its own for the globs to be read against, while spec
// §11's preview gate reads every service's filter against the repository the blueprint lives in, so
// the outcome is unstated rather than known to be nothing.
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
