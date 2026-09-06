import type { BlueprintResource } from '../../resources/resource.js';
import { describeGroups, envKeyOrigins } from '../env-key-origins.js';
import type { ValidationIssue } from '../issue.js';

// An environment map cannot repeat a key, so a repeat reaches a service through its group imports.
// The issue is reported against envGroups, because the resource itself declares no such key.
export const duplicateEnvKey = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] =>
  envKeyOrigins(resources).flatMap(({ resource, origins }) =>
    origins
      .filter((origin) => !origin.direct && origin.groups.length > 1)
      .map((origin): ValidationIssue => ({
        code: 'DuplicateEnvKey',
        at: { resource: resource.name, field: 'envGroups' },
        message: `The environment variable "${origin.key}" reaches "${resource.name}" from the environment ${describeGroups(origin.groups)}. Render has no precedence rule for a repeated key, so declare it in one group.`,
      })),
  );
