import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.1: paths and ignoredPaths are globs relative to the repository root, and spec §11 gates
// preview creation on a pull request's changed files matching one of them. spec §4.8: the four
// kinds below are the ones whose schema branch carries a build filter and an image source at once.
//
// INFERRED: no Render document says what a build filter does on a service built from a prebuilt
// image. An image source names no repository, so there is no commit whose changed files the globs
// could be read against, and the field can gate nothing.
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
            message: `"${resource.name}" runs a prebuilt image and sets a buildFilter, whose paths are globs relative to a repository root. An image source names no repository, so there are no changed files to read them against, and whether a sync stores the filter, ignores it, or rejects it is unstated.`,
          },
        ]
      : [],
  );
