import type { YAMLMap } from 'yaml';

import type { RootPreviews } from '../blueprint/blueprint.js';
import { ROOT_PREVIEWS_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';

export const rootPreviews = (value: RootPreviews | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(
        ROOT_PREVIEWS_KEY_ORDER,
        { generation: value.generation, expireAfterDays: value.expireAfterDays },
        undefined,
      );
