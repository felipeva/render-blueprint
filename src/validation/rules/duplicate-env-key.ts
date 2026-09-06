import { resolveEnv } from '../../env/resolve-env.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';

export const duplicateEnvKey = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const env = resource.config.env;
    if (env === undefined) continue;

    const seen = new Set<string>();
    for (const entry of resolveEnv(env)) {
      if (seen.has(entry.key)) {
        issues.push({
          code: 'DuplicateEnvKey',
          at: { resource: resource.name, field: `env.${entry.key}` },
          message: `The environment variable "${entry.key}" is declared more than once on "${resource.name}". Render has no precedence rule for a repeated key, so declare it once.`,
        });
      }
      seen.add(entry.key);
    }
  }

  return issues;
};
