import type { YAMLMap } from 'yaml';

import { DISK_FIELDS, type Disk } from '../resources/disk.js';
import { mapping } from './mapping.js';

export const disk = (value: Disk | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        DISK_FIELDS,
        { name: value.name, mountPath: value.mountPath, sizeGB: value.sizeGB },
        undefined,
      );
