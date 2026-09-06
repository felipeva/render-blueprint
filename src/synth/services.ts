import type { JsonObject } from '../json.js';
import type { BlueprintResource } from '../resources/resource.js';
import type { WebService } from '../resources/web.js';
import { envVars } from './env-vars.js';
import { WEB_SERVICE_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';

const webService = (resource: WebService): JsonObject => {
  const config = resource.config;

  return mapping(
    WEB_SERVICE_KEY_ORDER,
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

export const services = (resources: readonly BlueprintResource[]): readonly JsonObject[] =>
  resources.map((resource) => {
    switch (resource.kind) {
      case 'web':
        return webService(resource);
    }
  });
