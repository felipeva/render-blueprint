import { YAMLMap, YAMLSeq } from 'yaml';

import { KEY_VALUE_STORE_FIELDS, type KeyValueStore } from '../resources/key-value.js';
import { resourceEnv, type BlueprintResource } from '../resources/resource.js';
import {
  HEADER_FIELDS,
  ROUTE_FIELDS,
  STATIC_SITE_FIELDS,
  type Header,
  type Route,
  type StaticSite,
} from '../resources/static-site.js';
import { WEB_SERVICE_FIELDS, type WebService } from '../resources/web.js';
import { envVars } from './env-vars.js';
import { ipAllowList } from './ip-allow-list.js';
import { mapping } from './mapping.js';

const webService = (resource: WebService): YAMLMap => {
  const config = resource.config;

  return mapping(
    WEB_SERVICE_FIELDS,
    {
      type: 'web',
      name: resource.name,
      region: config.region,
      plan: config.plan,
      runtime: config.runtime,
      repo: config.repo,
      branch: config.branch,
      rootDir: config.rootDir,
      healthCheckPath: config.healthCheckPath,
      buildCommand: config.buildCommand,
      startCommand: config.startCommand,
      preDeployCommand: config.preDeployCommand,
      envVars: envVars(resourceEnv(resource), config.envGroups),
      autoDeployTrigger: config.autoDeployTrigger,
    },
    config.extraFields,
  );
};

const headers = (values: readonly Header[]): YAMLSeq => {
  const node = new YAMLSeq();

  for (const header of values) {
    node.add(
      mapping(
        HEADER_FIELDS,
        { path: header.path, name: header.name, value: header.value },
        undefined,
      ),
    );
  }

  return node;
};

const routes = (values: readonly Route[]): YAMLSeq => {
  const node = new YAMLSeq();

  for (const route of values) {
    node.add(
      mapping(
        ROUTE_FIELDS,
        { type: route.type, source: route.source, destination: route.destination },
        undefined,
      ),
    );
  }

  return node;
};

// spec §0.2: type: web is overloaded; runtime: static is what narrows it to a static site.
const staticSiteService = (resource: StaticSite): YAMLMap => {
  const config = resource.config;

  return mapping(
    STATIC_SITE_FIELDS,
    {
      type: 'web',
      name: resource.name,
      runtime: 'static',
      buildCommand: config.buildCommand,
      staticPublishPath: config.staticPublishPath,
      headers: config.headers === undefined ? undefined : headers(config.headers),
      routes: config.routes === undefined ? undefined : routes(config.routes),
      envVars: envVars(resourceEnv(resource), config.envGroups),
      rootDir: config.rootDir,
      repo: config.repo,
      branch: config.branch,
      domains: config.domains,
      autoDeployTrigger: config.autoDeployTrigger,
      preDeployCommand: config.preDeployCommand,
    },
    config.extraFields,
  );
};

// spec §5: a Key Value instance is a service to Render, and `keyvalue` retires the `redis` type.
const keyValueService = (resource: KeyValueStore): YAMLMap => {
  const config = resource.config;

  return mapping(
    KEY_VALUE_STORE_FIELDS,
    {
      type: 'keyvalue',
      name: resource.name,
      region: config.region,
      ipAllowList: ipAllowList(config.ipAllowList),
      plan: config.plan,
      maxmemoryPolicy: config.maxmemoryPolicy,
      persistenceMode: config.persistenceMode,
    },
    config.extraFields,
  );
};

const serviceNode = (resource: BlueprintResource): YAMLMap | undefined => {
  switch (resource.kind) {
    case 'web':
      return webService(resource);
    case 'staticSite':
      return staticSiteService(resource);
    case 'keyValue':
      return keyValueService(resource);
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const services = (resources: readonly BlueprintResource[]): YAMLSeq | undefined => {
  const node = new YAMLSeq();

  for (const resource of resources) {
    const service = serviceNode(resource);
    if (service !== undefined) node.add(service);
  }

  return node.items.length === 0 ? undefined : node;
};
