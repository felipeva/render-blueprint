import { YAMLSeq, type YAMLMap } from 'yaml';

import type {
  Environment,
  EnvironmentNetworking,
  EnvironmentPermissions,
} from '../blueprint/environment.js';
import type { Project } from '../blueprint/project.js';
import type { BlueprintResource } from '../resources/resource.js';
import {
  ENVIRONMENT_KEY_ORDER,
  ENVIRONMENT_NETWORKING_KEY_ORDER,
  ENVIRONMENT_PERMISSIONS_KEY_ORDER,
  PROJECT_KEY_ORDER,
  UNGROUPED_KEY_ORDER,
} from './key-order.js';
import { databases } from './databases.js';
import { mapping } from './mapping.js';
import { services } from './services.js';

const networking = (value: EnvironmentNetworking | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(ENVIRONMENT_NETWORKING_KEY_ORDER, { isolation: value.isolation }, undefined);

const permissions = (value: EnvironmentPermissions | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(ENVIRONMENT_PERMISSIONS_KEY_ORDER, { protection: value.protection }, undefined);

const environmentNode = (value: Environment): YAMLMap =>
  mapping(
    ENVIRONMENT_KEY_ORDER,
    {
      name: value.name,
      services: services(value.resources),
      databases: databases(value.resources),
      networking: networking(value.networking),
      permissions: permissions(value.permissions),
    },
    undefined,
  );

const environments = (values: readonly Environment[]): YAMLSeq => {
  const node = new YAMLSeq();
  for (const value of values) node.add(environmentNode(value));
  return node;
};

export const projects = (values: readonly Project[]): YAMLSeq | undefined => {
  if (values.length === 0) return undefined;

  const node = new YAMLSeq();
  for (const value of values) {
    node.add(
      mapping(
        PROJECT_KEY_ORDER,
        { name: value.name, environments: environments(value.environments) },
        undefined,
      ),
    );
  }

  return node;
};

export const ungrouped = (resources: readonly BlueprintResource[]): YAMLMap | undefined =>
  resources.length === 0
    ? undefined
    : mapping(
        UNGROUPED_KEY_ORDER,
        { services: services(resources), databases: databases(resources) },
        undefined,
      );
