import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §9: a database is not built from source, so no build command applies to one.
const runtime = (resource: BlueprintResource): string | undefined => {
  switch (resource.kind) {
    case 'web':
      return resource.config.runtime;
    case 'staticSite':
      return 'static';
    case 'postgres':
      return undefined;
  }
};

export const missingBuildCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] => {
    const on = runtime(resource);

    return on === undefined || resource.config.buildCommand !== undefined
      ? []
      : [
          {
            code: 'MissingBuildCommand',
            at: { resource: resource.name, field: 'buildCommand' },
            message: `"${resource.name}" runs on the "${on}" runtime with no buildCommand. Render's documentation calls it required for every service it builds from source.`,
          },
        ];
  });
