import type { BlueprintResource } from '../../resources/resource.js';
import { describeGroups, envKeyOrigins } from '../env-key-origins.js';
import type { ValidationIssue } from '../issue.js';

// spec §6.4: Render merges environment variables by key with no precedence rule, so a key a
// service sets directly and also imports through a group has no defined winner.
export const envKeyCollision = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] =>
  resources.flatMap((resource) =>
    envKeyOrigins(resource)
      .filter((origin) => origin.direct && origin.groups.length > 0)
      .map((origin): ValidationIssue => ({
        code: 'EnvKeyCollision',
        at: { resource: resource.name, field: `env.${origin.key}` },
        message: `"${resource.name}" sets "${origin.key}" directly and imports it from the environment ${describeGroups(origin.groups)}. Render has no precedence rule between the two, so declare the key in one place.`,
      })),
  );
