import type { EnvironmentGroup } from '../resources/env-group.js';
import { resourceEnv, resourceEnvGroups, type BlueprintResource } from '../resources/resource.js';
import { describeNames } from './describe-names.js';

export interface EnvKeyOrigin {
  readonly key: string;
  readonly direct: boolean;
  readonly groups: readonly string[];
}

export interface ResourceEnvKeyOrigins {
  readonly resource: BlueprintResource;
  readonly origins: readonly EnvKeyOrigin[];
}

export const describeGroups = (names: readonly string[]): string =>
  `${names.length === 1 ? 'group' : 'groups'} ${describeNames(names)}`;

const listedGroups = (
  resources: readonly BlueprintResource[],
): ReadonlyMap<string, EnvironmentGroup> => {
  const groups = new Map<string, EnvironmentGroup>();

  for (const resource of resources) {
    if (resource.kind === 'envGroup') groups.set(resource.name, resource);
  }

  return groups;
};

// spec §6.1: a fromGroup entry carries the group's name.
const importedGroup = (
  held: EnvironmentGroup,
  listed: ReadonlyMap<string, EnvironmentGroup>,
): EnvironmentGroup => listed.get(held.name) ?? held;

// Importing one group twice imports one set of values, so a repeated name is not a second origin.
const importedKeys = (
  resource: BlueprintResource,
  listed: ReadonlyMap<string, EnvironmentGroup>,
): ReadonlyMap<string, readonly string[]> => {
  const origins = new Map<string, readonly string[]>();

  for (const held of resourceEnvGroups(resource) ?? []) {
    const group = importedGroup(held, listed);

    for (const key of Object.keys(group.config.env)) {
      const named = origins.get(key) ?? [];
      if (!named.includes(group.name)) origins.set(key, [...named, group.name]);
    }
  }

  return origins;
};

const originsOf = (
  resource: BlueprintResource,
  listed: ReadonlyMap<string, EnvironmentGroup>,
): readonly EnvKeyOrigin[] => {
  const imported = importedKeys(resource, listed);
  const declared = Object.keys(resourceEnv(resource) ?? {});
  const direct = new Set(declared);
  const importedOnly = [...imported.keys()].filter((key) => !direct.has(key));

  return [...declared, ...importedOnly].map((key) => ({
    key,
    direct: direct.has(key),
    groups: imported.get(key) ?? [],
  }));
};

// spec §6.1: a fromGroup entry names no key.
export const envKeyOrigins = (
  resources: readonly BlueprintResource[],
): readonly ResourceEnvKeyOrigins[] => {
  const listed = listedGroups(resources);

  return resources.map((resource) => ({ resource, origins: originsOf(resource, listed) }));
};
