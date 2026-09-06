import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

interface BuiltFromSource {
  readonly runtime: string;
  readonly buildCommand: string | undefined;
}

// spec §9 and §5: a database is not built from source, a Key Value instance is not, and neither is
// a group, so no build command applies to any of them.
const builtFromSource = (resource: BlueprintResource): BuiltFromSource | undefined => {
  switch (resource.kind) {
    case 'web':
      return { runtime: resource.config.runtime, buildCommand: resource.config.buildCommand };
    case 'staticSite':
      return { runtime: 'static', buildCommand: resource.config.buildCommand };
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const missingBuildCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] => {
    const built = builtFromSource(resource);

    return built === undefined || built.buildCommand !== undefined
      ? []
      : [
          {
            code: 'MissingBuildCommand',
            at: { resource: resource.name, field: 'buildCommand' },
            message: `"${resource.name}" runs on the "${built.runtime}" runtime with no buildCommand. Render's documentation calls it required for every service it builds from source.`,
          },
        ];
  });
