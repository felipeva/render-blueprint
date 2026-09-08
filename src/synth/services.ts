import { YAMLSeq, type YAMLMap } from 'yaml';

import type { BlueprintResource } from '../resources/resource.js';
import { cronJob } from './cron-job.js';
import { keyValueStore } from './key-value-store.js';
import { privateService } from './private-service.js';
import { staticSite } from './static-site.js';
import { webService } from './web-service.js';
import { workerService } from './worker-service.js';

const serviceNode = (resource: BlueprintResource): YAMLMap | undefined => {
  switch (resource.kind) {
    case 'web':
      return webService(resource);
    case 'privateService':
      return privateService(resource);
    case 'worker':
      return workerService(resource);
    case 'cron':
      return cronJob(resource);
    case 'staticSite':
      return staticSite(resource);
    case 'keyValue':
      return keyValueStore(resource);
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
