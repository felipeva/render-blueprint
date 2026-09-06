import type { EnvironmentGroup } from '../resources/env-group.js';
import { resourceEnv, resourceEnvGroups, type BlueprintResource } from '../resources/resource.js';

export interface EnvKeyOrigin {
  readonly key: string;
  readonly direct: boolean;
  readonly groups: readonly string[];
}

export interface ResourceEnvKeyOrigins {
  readonly resource: BlueprintResource;
  readonly origins: readonly EnvKeyOrigin[];
}

export const describeGroups = (names: readonly string[]): string => {
  const quoted = names.map((name) => `"${name}"`);
  const last = quoted.at(-1) ?? '';
  const rest = quoted.slice(0, -1);

  return `${names.length === 1 ? 'group' : 'groups'} ${
    rest.length === 0 ? last : `${rest.join(', ')} and ${last}`
  }`;
};

const listedGroups = (
  resources: readonly BlueprintResource[],
): ReadonlyMap<string, EnvironmentGroup> => {
  const groups = new Map<string, EnvironmentGroup>();

  for (const resource of resources) {
    if (resource.kind === 'envGroup') groups.set(resource.name, resource);
  }

  return groups;
};

// spec §6.1: a fromGroup entry carries the group's name, and Render resolves it against the groups
// the blueprint declares. So the listed group of that name is what a service imports, whichever
// object it holds; a name no listed group answers to is a group the Dashboard manages (spec §6.3),
// and the held object is then the only description of its keys there is.
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

// spec §6.1: a fromGroup entry names no key, so a group is the only place the keys it carries into
// a service are written down. Both key rules read this list rather than the emitted entries.
export const envKeyOrigins = (
  resources: readonly BlueprintResource[],
): readonly ResourceEnvKeyOrigins[] => {
  const listed = listedGroups(resources);

  return resources.map((resource) => ({ resource, origins: originsOf(resource, listed) }));
};
