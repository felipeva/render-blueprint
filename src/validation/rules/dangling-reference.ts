import { resolveEnv } from '../../env/resolve-env.js';
import type { BlueprintResource } from '../../resources/resource.js';
import { resourceEnv } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';
import type { ParsedConfigs } from '../parse-configs.js';

// spec §12: readReplicas[].name declares a replica, which spec §9 makes a fromDatabase target too.
const referenceTargets = (resources: readonly BlueprintResource[]): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const resource of resources) {
    if (resource.kind !== 'postgres') continue;

    names.add(resource.name);
    // The name tier runs ahead of config parsing (ADR-0003), so this list may not be one yet.
    const declared = resource.config?.readReplicas;
    if (Array.isArray(declared)) for (const replica of declared) names.add(replica.name);
  }

  return names;
};

// Targets come from the name tier, not the accepted one: a database whose config failed to parse
// is still declared, and reporting its dependants as dangling would blame the wrong resource.
export const danglingReference = (parsed: ParsedConfigs): readonly ValidationIssue[] => {
  const targets = referenceTargets(parsed.named);
  const issues: ValidationIssue[] = [];

  for (const resource of parsed.accepted) {
    const env = resourceEnv(resource);
    if (env === undefined) continue;

    for (const entry of resolveEnv(env, undefined)) {
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
