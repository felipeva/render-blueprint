import type { YAMLMap } from 'yaml';

import { PRIVATE_SERVICE_FIELDS, type PrivateService } from '../resources/private-service.js';
import { resourceEnv } from '../resources/resource.js';
import { buildFilter } from './build-filter.js';
import { disk } from './disk.js';
import { envVars } from './env-vars.js';
import { mapping } from './mapping.js';
import { scaling } from './scaling.js';
import { servicePreviews } from './service-previews.js';
import { sourceValues } from './service-source.js';

// spec §3.1: `pserv` is the type Render spells a private service with.
export const privateService = (resource: PrivateService): YAMLMap => {
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
      initialDeployHook: config.initialDeployHook,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
    },
    config.extraFields,
  );
};
