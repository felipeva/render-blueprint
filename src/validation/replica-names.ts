import { readReplicaSchema, type ReadReplica } from '../resources/read-replica.js';
import type { BlueprintResource } from '../resources/resource.js';

const declaredReplicas = (resource: BlueprintResource): readonly ReadReplica[] | undefined =>
  resource.kind === 'postgres' ? resource.config?.readReplicas : undefined;

// The schema reads a key as present with `in`, whatever its value, undefined included; Object()
// boxes a config that is not an object, which `in` would throw on.
const declaresReplicas = (resource: BlueprintResource): boolean =>
  resource.kind === 'postgres' && 'readReplicas' in Object(resource.config);

// spec §9 and §12: a read replica is addressed by its own name, so it shares the one namespace.
// The name tier runs ahead of config parsing (ADR-0003): only an entry that parses is a replica.
export const replicaNames = (resource: BlueprintResource): readonly string[] => {
  const declared = declaredReplicas(resource);
  if (!Array.isArray(declared)) return [];

  return declared.flatMap((replica): readonly string[] => {
    const parsed = readReplicaSchema.safeParse(replica);
    return parsed.success ? [parsed.data.name] : [];
  });
};

export const declaresUnparsedReplica = (resource: BlueprintResource): boolean => {
  if (!declaresReplicas(resource)) return false;

  const declared = declaredReplicas(resource);
  if (!Array.isArray(declared)) return true;

  // A hole is an entry the schema rejects, and some() would skip it.
  for (const replica of declared) {
    if (!readReplicaSchema.safeParse(replica).success) return true;
  }

  return false;
};
