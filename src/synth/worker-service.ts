import type { YAMLMap } from 'yaml';

import { resourceEnv } from '../resources/resource.js';
import { WORKER_FIELDS, type Worker } from '../resources/worker.js';
import { buildFilter } from './build-filter.js';
import { disk } from './disk.js';
import { envVars } from './env-vars.js';
import { mapping } from './mapping.js';
import { scaling } from './scaling.js';
import { servicePreviews } from './service-previews.js';
import { sourceValues } from './service-source.js';

export const workerService = (resource: Worker): YAMLMap => {
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
      initialDeployHook: config.initialDeployHook,
      disk: disk(config.disk),
      buildFilter: buildFilter(config.buildFilter),
      previews: servicePreviews(config.previews),
      maxShutdownDelaySeconds: config.maxShutdownDelaySeconds,
    },
    config.extraFields,
  );
};
