import type { YAMLMap } from 'yaml';

import { SERVICE_PREVIEWS_FIELDS, type ServicePreviews } from '../resources/previews.js';
import { mapping } from './mapping.js';

// design B §2.6: the instance count is `instances` in TypeScript wherever it appears.
export const servicePreviews = (value: ServicePreviews | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        SERVICE_PREVIEWS_FIELDS,
        { generation: value.generation, plan: value.plan, numInstances: value.instances },
        undefined,
      );
