import { YAMLMap, YAMLSeq } from 'yaml';

import type { BlueprintResource } from '../resources/resource.js';
import { WEB_SERVICE_FIELDS, type WebService } from '../resources/web.js';
import { envVars } from './env-vars.js';
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
      envVars: config.env === undefined ? undefined : envVars(config.env),
      autoDeployTrigger: config.autoDeployTrigger,
    },
    config.extraFields,
  );
};

const serviceNode = (resource: BlueprintResource): YAMLMap => {
  switch (resource.kind) {
    case 'web':
      return webService(resource);
  }
};

export const services = (resources: readonly BlueprintResource[]): YAMLSeq | undefined => {
  if (resources.length === 0) return undefined;

  const node = new YAMLSeq();
  for (const resource of resources) node.add(serviceNode(resource));
  return node;
};
