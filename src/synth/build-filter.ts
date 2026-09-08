import type { YAMLMap } from 'yaml';

import { BUILD_FILTER_FIELDS, type BuildFilter } from '../resources/build-filter.js';
import { mapping } from './mapping.js';

export const buildFilter = (value: BuildFilter | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        BUILD_FILTER_FIELDS,
        { paths: value.paths, ignoredPaths: value.ignoredPaths },
        undefined,
      );
