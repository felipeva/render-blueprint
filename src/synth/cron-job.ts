import type { YAMLMap } from 'yaml';

import { CRON_JOB_FIELDS, type CronJob } from '../resources/cron.js';
import { resourceEnv } from '../resources/resource.js';
import { buildFilter } from './build-filter.js';
import { envVars } from './env-vars.js';
import { mapping } from './mapping.js';
import { sourceValues } from './service-source.js';

// spec §4.8: the cron branch orders its keys its own way, and carries the schedule no other does.
export const cronJob = (resource: CronJob): YAMLMap => {
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
