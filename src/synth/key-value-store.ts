import type { YAMLMap } from 'yaml';

import { KEY_VALUE_STORE_FIELDS, type KeyValueStore } from '../resources/key-value.js';
import { ipAllowList } from './ip-allow-list.js';
import { mapping } from './mapping.js';

// spec §5: a Key Value instance is a service to Render, and `keyvalue` retires the `redis` type.
export const keyValueStore = (resource: KeyValueStore): YAMLMap => {
  const config = resource.config;

  return mapping(
    KEY_VALUE_STORE_FIELDS,
    {
      type: 'keyvalue',
      name: resource.name,
      region: config.region,
      ipAllowList: ipAllowList(config.ipAllowList),
      plan: config.plan,
      previewPlan: config.previews?.plan,
      maxmemoryPolicy: config.maxmemoryPolicy,
      persistenceMode: config.persistenceMode,
    },
    config.extraFields,
  );
};
