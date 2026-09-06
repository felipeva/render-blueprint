import { resourceEnv, resourceEnvGroups, type BlueprintResource } from '../resources/resource.js';

export interface EnvKeyOrigin {
  readonly key: string;
  readonly direct: boolean;
  readonly groups: readonly string[];
}

export const describeGroups = (names: readonly string[]): string =>
  `${names.length === 1 ? 'group' : 'groups'} ${names.map((name) => `"${name}"`).join(' and ')}`;

// Importing one group twice imports one set of values, so a repeated name is not a second origin.
const importedKeys = (resource: BlueprintResource): ReadonlyMap<string, readonly string[]> => {
  const origins = new Map<string, readonly string[]>();

  for (const group of resourceEnvGroups(resource) ?? []) {
    for (const key of Object.keys(group.config.env)) {
      const named = origins.get(key) ?? [];
      if (!named.includes(group.name)) origins.set(key, [...named, group.name]);
    }
  }

  return origins;
};

// spec §6.1: a fromGroup entry names no key, so the group a service imports is the only place its
// keys are written down. Both key rules read this list rather than the emitted entries.
export const envKeyOrigins = (resource: BlueprintResource): readonly EnvKeyOrigin[] => {
  const imported = importedKeys(resource);
  const declared = Object.keys(resourceEnv(resource) ?? {});
  const direct = new Set(declared);
  const importedOnly = [...imported.keys()].filter((key) => !direct.has(key));

  return [...declared, ...importedOnly].map((key) => ({
    key,
    direct: direct.has(key),
    groups: imported.get(key) ?? [],
  }));
};
