import { resolveEnv } from '../../env/resolve-env.js';
import type { BlueprintResource } from '../../resources/resource.js';
import { resourceEnv, serviceReferenceType } from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';
import type { ParsedConfigs } from '../parse-configs.js';

// spec §12: readReplicas[].name declares a replica, which spec §9 makes a fromDatabase target too.
const databaseTargets = (resources: readonly BlueprintResource[]): ReadonlySet<string> => {
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
const serviceTargets = (resources: readonly BlueprintResource[]): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const resource of resources) {
    if (serviceReferenceType(resource) !== undefined) names.add(resource.name);
  }

  return names;
};

export const danglingReference = (parsed: ParsedConfigs): readonly ValidationIssue[] => {
  const databases = databaseTargets(parsed.named);
  const services = serviceTargets(parsed.named);
  const issues: ValidationIssue[] = [];

  for (const resource of parsed.accepted) {
    const env = resourceEnv(resource);
    if (env === undefined) continue;

    for (const entry of resolveEnv(env, undefined)) {
      // An external handle names a resource this blueprint does not manage, so no list resolves it.
      if (entry.form !== 'fromDatabase' && entry.form !== 'fromService') continue;
      if (entry.reference.origin === 'external') continue;

      if (entry.form === 'fromDatabase' && !databases.has(entry.reference.name)) {
        issues.push({
          code: 'DanglingReference',
          at: { resource: resource.name, field: `env.${entry.key}` },
          message: `"${resource.name}" reads "${entry.key}" from the database "${entry.reference.name}", which this blueprint does not list. Add it to resources, or declare it as a read replica of a database that is listed.`,
        });
      }

      if (entry.form === 'fromService' && !services.has(entry.reference.name)) {
        issues.push({
          code: 'DanglingReference',
          at: { resource: resource.name, field: `env.${entry.key}` },
          message: `"${resource.name}" reads "${entry.key}" from the service "${entry.reference.name}", which this blueprint does not list. Add it to resources, or reach for it through an external handle.`,
        });
      }
    }
  }

  return issues;
};
