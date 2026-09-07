import { YAMLMap, YAMLSeq } from 'yaml';

import { BUILD_FILTER_FIELDS, type BuildFilter } from '../resources/build-filter.js';
import { CRON_JOB_FIELDS, type CronJob } from '../resources/cron.js';
import { DISK_FIELDS, type Disk } from '../resources/disk.js';
import { KEY_VALUE_STORE_FIELDS, type KeyValueStore } from '../resources/key-value.js';
import { SERVICE_PREVIEWS_FIELDS, type ServicePreviews } from '../resources/previews.js';
import { PRIVATE_SERVICE_FIELDS, type PrivateService } from '../resources/private-service.js';
import { resourceEnv, type BlueprintResource } from '../resources/resource.js';
import { SCALING_FIELDS, type Scaling } from '../resources/scaling.js';
import {
  HEADER_FIELDS,
  ROUTE_FIELDS,
  STATIC_SITE_FIELDS,
  STATIC_SITE_PREVIEWS_FIELDS,
  type Header,
  type Route,
  type StaticSite,
  type StaticSitePreviews,
} from '../resources/static-site.js';
import { WEB_SERVICE_FIELDS, type WebService } from '../resources/web.js';
import { WORKER_FIELDS, type Worker } from '../resources/worker.js';
import { envVars } from './env-vars.js';
import { ipAllowList } from './ip-allow-list.js';
import { mapping } from './mapping.js';
import { sourceValues } from './service-source.js';

const disk = (value: Disk | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        DISK_FIELDS,
        { name: value.name, mountPath: value.mountPath, sizeGB: value.sizeGB },
        undefined,
      );

const scaling = (value: Scaling | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        SCALING_FIELDS,
        {
          minInstances: value.minInstances,
          maxInstances: value.maxInstances,
          targetMemoryPercent: value.targetMemoryPercent,
          targetCPUPercent: value.targetCPUPercent,
        },
        undefined,
      );

const buildFilter = (value: BuildFilter | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        BUILD_FILTER_FIELDS,
        { paths: value.paths, ignoredPaths: value.ignoredPaths },
        undefined,
      );

// design B §2.6: the instance count is `instances` in TypeScript wherever it appears.
const servicePreviews = (value: ServicePreviews | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        SERVICE_PREVIEWS_FIELDS,
        { generation: value.generation, plan: value.plan, numInstances: value.instances },
        undefined,
      );

const staticSitePreviews = (value: StaticSitePreviews | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(STATIC_SITE_PREVIEWS_FIELDS, { generation: value.generation }, undefined);

const webService = (resource: WebService): YAMLMap => {
  const config = resource.config;
  const source = sourceValues(config);

  return mapping(
    WEB_SERVICE_FIELDS,
    {
      type: 'web',
      name: resource.name,
      region: config.region,
      plan: config.plan,
      runtime: source.runtime,
      repo: source.repo,
      branch: source.branch,
      image: source.image,
      rootDir: source.rootDir,
      dockerCommand: source.dockerCommand,
      dockerContext: source.dockerContext,
      dockerfilePath: source.dockerfilePath,
      numInstances: config.instances,
      healthCheckPath: config.healthCheckPath,
      scaling: scaling(config.scaling),
      buildCommand: source.buildCommand,
      startCommand: config.startCommand,
      preDeployCommand: config.preDeployCommand,
      registryCredential: source.registryCredential,
      domains: config.domains,
      envVars: envVars(resourceEnv(resource), config.envGroups),
      autoDeployTrigger: config.autoDeployTrigger,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
      ipAllowList: config.ipAllowList === undefined ? undefined : ipAllowList(config.ipAllowList),
    },
    config.extraFields,
  );
};

// spec §3.1: `pserv` is the type Render spells a private service with.
const privateServiceService = (resource: PrivateService): YAMLMap => {
  const config = resource.config;
  const source = sourceValues(config);

  return mapping(
    PRIVATE_SERVICE_FIELDS,
    {
      type: 'pserv',
      name: resource.name,
      region: config.region,
      plan: config.plan,
      runtime: source.runtime,
      repo: source.repo,
      branch: source.branch,
      image: source.image,
      rootDir: source.rootDir,
      dockerCommand: source.dockerCommand,
      dockerContext: source.dockerContext,
      dockerfilePath: source.dockerfilePath,
      numInstances: config.instances,
      scaling: scaling(config.scaling),
      buildCommand: source.buildCommand,
      startCommand: config.startCommand,
      preDeployCommand: config.preDeployCommand,
      registryCredential: source.registryCredential,
      envVars: envVars(resourceEnv(resource), config.envGroups),
      autoDeployTrigger: config.autoDeployTrigger,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
    },
    config.extraFields,
  );
};

const workerService = (resource: Worker): YAMLMap => {
  const config = resource.config;
  const source = sourceValues(config);

  return mapping(
    WORKER_FIELDS,
    {
      type: 'worker',
      name: resource.name,
      region: config.region,
      plan: config.plan,
      runtime: source.runtime,
      repo: source.repo,
      branch: source.branch,
      image: source.image,
      rootDir: source.rootDir,
      dockerCommand: source.dockerCommand,
      dockerContext: source.dockerContext,
      dockerfilePath: source.dockerfilePath,
      numInstances: config.instances,
      scaling: scaling(config.scaling),
      buildCommand: source.buildCommand,
      startCommand: config.startCommand,
      preDeployCommand: config.preDeployCommand,
      registryCredential: source.registryCredential,
      envVars: envVars(resourceEnv(resource), config.envGroups),
      autoDeployTrigger: config.autoDeployTrigger,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
    },
    config.extraFields,
  );
};

// spec §4.8: the cron branch orders its keys its own way, and carries the schedule no other does.
const cronService = (resource: CronJob): YAMLMap => {
  const config = resource.config;
  const source = sourceValues(config);

  return mapping(
    CRON_JOB_FIELDS,
    {
      type: 'cron',
      name: resource.name,
      region: config.region,
      plan: config.plan,
      runtime: source.runtime,
      schedule: config.schedule,
      buildCommand: source.buildCommand,
      startCommand: config.startCommand,
      dockerCommand: source.dockerCommand,
      dockerfilePath: source.dockerfilePath,
      dockerContext: source.dockerContext,
      registryCredential: source.registryCredential,
      repo: source.repo,
      branch: source.branch,
      image: source.image,
      envVars: envVars(resourceEnv(resource), config.envGroups),
      buildFilter: buildFilter(config.buildFilter),
      rootDir: source.rootDir,
      autoDeployTrigger: config.autoDeployTrigger,
      preDeployCommand: config.preDeployCommand,
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
      previews: staticSitePreviews(config.previews),
      buildFilter: buildFilter(config.buildFilter),
      headers: config.headers === undefined ? undefined : headers(config.headers),
      routes: config.routes === undefined ? undefined : routes(config.routes),
      envVars: envVars(resourceEnv(resource), config.envGroups),
      rootDir: config.rootDir,
      repo: config.repo,
      branch: config.branch,
      domains: config.domains,
      autoDeployTrigger: config.autoDeployTrigger,
      preDeployCommand: config.preDeployCommand,
      ipAllowList: config.ipAllowList === undefined ? undefined : ipAllowList(config.ipAllowList),
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
      previewPlan: config.previews?.plan,
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
    case 'privateService':
      return privateServiceService(resource);
    case 'worker':
      return workerService(resource);
    case 'cron':
      return cronService(resource);
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
