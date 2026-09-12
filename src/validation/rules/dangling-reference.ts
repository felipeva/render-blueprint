import type { ReferenceableServiceType } from '../../enums/referenceable-service-type.js';
import { resolveEnv } from '../../env/resolve-env.js';
import type { ServiceReferenceValue } from '../../references/reference-value.js';
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
    // An entry may not be a replica; a missing target blames the wrong resource, so any name counts.
    const declared = resource.config?.readReplicas;
    if (Array.isArray(declared)) for (const replica of declared) names.add(replica?.name);
  }

  return names;
};

// spec §6.2: a fromService node names a type beside the name, and Render resolves the pair.
const serviceTargets = (
  resources: readonly BlueprintResource[],
): ReadonlyMap<string, ReferenceableServiceType> => {
  const targets = new Map<string, ReferenceableServiceType>();

  for (const resource of resources) {
    const type = serviceReferenceType(resource);
    if (type !== undefined) targets.set(resource.name, type);
  }

  return targets;
};

const mismatch = (
  resource: string,
  key: string,
  reference: ServiceReferenceValue,
  listed: ReferenceableServiceType | undefined,
): ValidationIssue => ({
  code: 'DanglingReference',
  at: { resource, field: `env.${key}` },
  message:
    listed === undefined
      ? `"${resource}" reads "${key}" from the service "${reference.name}", which this blueprint does not list. Add it to resources, or reach for it through an external handle.`
      : `"${resource}" reads "${key}" from the "${reference.type}" service "${reference.name}", and the only "${reference.name}" this blueprint lists is a "${listed}" service. Render resolves a fromService reference by name and type together.`,
});

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

      if (entry.form === 'fromService') {
        const listed = services.get(entry.reference.name);
        if (listed !== entry.reference.type) {
          issues.push(mismatch(resource.name, entry.key, entry.reference, listed));
        }
      }
    }
  }

  return issues;
};
