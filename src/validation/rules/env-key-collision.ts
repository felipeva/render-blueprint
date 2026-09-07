import type { BlueprintResource } from '../../resources/resource.js';
import { describeGroups, envKeyOrigins } from '../env-key-origins.js';
import type { ValidationIssue } from '../issue.js';

// INFERRED: no Render document says which value wins when a service sets a key directly and
// imports the same key through a group.
export const envKeyCollision = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] =>
  envKeyOrigins(resources).flatMap(({ resource, origins }) =>
    origins
      .filter((origin) => origin.direct && origin.groups.length > 0)
      .map((origin): ValidationIssue => ({
        code: 'EnvKeyCollision',
        at: { resource: resource.name, field: `env.${origin.key}` },
        message: `"${resource.name}" sets "${origin.key}" directly and imports it from the environment ${describeGroups(origin.groups)}. Render resolves neither against the other, so declare the key in one place.`,
      })),
  );
