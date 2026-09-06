import { YAMLSeq } from 'yaml';

import { IP_ALLOW_LIST_ENTRY_FIELDS, type IpAllowList } from '../resources/ip-allow-list.js';
import { mapping } from './mapping.js';

// An empty list is not an omitted one: spec §7 reads it as "block all external connections".
export const ipAllowList = (entries: IpAllowList): YAMLSeq => {
  const node = new YAMLSeq();

  for (const entry of entries) {
    node.add(
      mapping(
        IP_ALLOW_LIST_ENTRY_FIELDS,
        { source: entry.source, description: entry.description },
        undefined,
      ),
    );
  }

  return node;
};
