import type { YAMLMap } from 'yaml';

import { SCALING_FIELDS, type Scaling } from '../resources/scaling.js';
import { mapping } from './mapping.js';

export const scaling = (value: Scaling | undefined): YAMLMap | undefined =>
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
