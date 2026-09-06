import { resolveEnv } from '../../env/resolve-env.js';
import { resourceEnv, type BlueprintResource } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';

// spec §11: readReplicas[].name declares a replica, which becomes a fromDatabase target too.
const referenceTargets = (resources: readonly BlueprintResource[]): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const resource of resources) {
    if (resource.kind !== 'postgres') continue;

    names.add(resource.name);
    for (const replica of resource.config.readReplicas ?? []) names.add(replica.name);
  }

  return names;
};

export const danglingReference = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const targets = referenceTargets(resources);
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const env = resourceEnv(resource);
    if (env === undefined) continue;

    for (const entry of resolveEnv(env)) {
      if (entry.form !== 'fromDatabase' || targets.has(entry.reference.name)) continue;

      issues.push({
        code: 'DanglingReference',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" reads "${entry.key}" from the database "${entry.reference.name}", which this blueprint does not list. Add it to resources, or declare it as a read replica of a database that is listed.`,
      });
    }
  }

  return issues;
};
