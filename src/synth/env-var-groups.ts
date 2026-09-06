import { YAMLMap, YAMLSeq } from 'yaml';

import { ENVIRONMENT_GROUP_FIELDS, type EnvironmentGroup } from '../resources/env-group.js';
import type { BlueprintResource } from '../resources/resource.js';
import { envVars } from './env-vars.js';
import { mapping } from './mapping.js';

// spec §6.1: a group's items take the key-value form only, so the list an env map produces is
// already the list a group emits.
const envVarGroup = (resource: EnvironmentGroup): YAMLMap =>
  mapping(
    ENVIRONMENT_GROUP_FIELDS,
    { name: resource.name, envVars: envVars(resource.config.env, undefined) },
    resource.config.extraFields,
  );

const groupNode = (resource: BlueprintResource): YAMLMap | undefined => {
  switch (resource.kind) {
    case 'envGroup':
      return envVarGroup(resource);
    case 'web':
    case 'staticSite':
    case 'postgres':
      return undefined;
  }
};

export const envVarGroups = (resources: readonly BlueprintResource[]): YAMLSeq | undefined => {
  const node = new YAMLSeq();

  for (const resource of resources) {
    const entry = groupNode(resource);
    if (entry !== undefined) node.add(entry);
  }

  return node.items.length === 0 ? undefined : node;
};
