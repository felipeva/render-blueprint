import type { YAMLMap } from 'yaml';

import { resourceEnv } from '../resources/resource.js';
import {
  MAINTENANCE_MODE_FIELDS,
  WEB_SERVICE_FIELDS,
  type MaintenanceMode,
  type WebService,
} from '../resources/web.js';
import { buildFilter } from './build-filter.js';
import { disk } from './disk.js';
import { envVars } from './env-vars.js';
import { ipAllowList } from './ip-allow-list.js';
import { mapping } from './mapping.js';
import { scaling } from './scaling.js';
import { servicePreviews } from './service-previews.js';
import { sourceValues } from './service-source.js';

const maintenanceMode = (value: MaintenanceMode | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(MAINTENANCE_MODE_FIELDS, { enabled: value.enabled, uri: value.uri }, undefined);

export const webService = (resource: WebService): YAMLMap => {
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
      initialDeployHook: config.initialDeployHook,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maintenanceMode: maintenanceMode(config.maintenanceMode),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
      ipAllowList: config.ipAllowList === undefined ? undefined : ipAllowList(config.ipAllowList),
      renderSubdomainPolicy: config.renderSubdomainPolicy,
    },
    config.extraFields,
  );
};
