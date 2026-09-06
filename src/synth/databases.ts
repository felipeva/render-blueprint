import { YAMLMap, YAMLSeq } from 'yaml';

import { IP_ALLOW_LIST_ENTRY_FIELDS, type IpAllowList } from '../resources/ip-allow-list.js';
import {
  HIGH_AVAILABILITY_FIELDS,
  POSTGRES_DATABASE_FIELDS,
  type HighAvailability,
  type PostgresDatabase,
} from '../resources/postgres.js';
import { READ_REPLICA_FIELDS, type ReadReplica } from '../resources/read-replica.js';
import type { BlueprintResource } from '../resources/resource.js';
import { mapping } from './mapping.js';

const highAvailability = (value: HighAvailability): YAMLMap =>
  mapping(HIGH_AVAILABILITY_FIELDS, { enabled: value.enabled }, undefined);

// An empty list is not an omitted one: spec §9 reads it as "allow no external connection".
const ipAllowList = (entries: IpAllowList): YAMLSeq => {
  const node = new YAMLSeq();

  for (const entry of entries) {
    node.add(
      mapping(
        IP_ALLOW_LIST_ENTRY_FIELDS,
        { source: entry.source, description: entry.description },
        undefined,
      ),
    );
  }

  return node;
};

// spec §9: the list is name-diffed, so an empty one destroys every replica and omission keeps them.
const readReplicas = (replicas: readonly ReadReplica[]): YAMLSeq => {
  const node = new YAMLSeq();

  for (const replica of replicas) {
    node.add(mapping(READ_REPLICA_FIELDS, { name: replica.name }, undefined));
  }

  return node;
};

const database = (resource: PostgresDatabase): YAMLMap => {
  const config = resource.config;

  return mapping(
    POSTGRES_DATABASE_FIELDS,
    {
      name: resource.name,
      databaseName: config.databaseName,
      user: config.user,
      region: config.region,
      plan: config.plan,
      diskSizeGB: config.diskSizeGB,
      postgresMajorVersion: config.postgresMajorVersion,
      highAvailability:
        config.highAvailability === undefined
          ? undefined
          : highAvailability(config.highAvailability),
      ipAllowList: config.ipAllowList === undefined ? undefined : ipAllowList(config.ipAllowList),
      readReplicas:
        config.readReplicas === undefined ? undefined : readReplicas(config.readReplicas),
    },
    config.extraFields,
  );
};

const databaseNode = (resource: BlueprintResource): YAMLMap | undefined => {
  switch (resource.kind) {
    case 'postgres':
      return database(resource);
    case 'web':
      return undefined;
  }
};

export const databases = (resources: readonly BlueprintResource[]): YAMLSeq | undefined => {
  const node = new YAMLSeq();

  for (const resource of resources) {
    const entry = databaseNode(resource);
    if (entry !== undefined) node.add(entry);
  }

  return node.items.length === 0 ? undefined : node;
};
