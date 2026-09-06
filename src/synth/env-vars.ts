import { YAMLMap, YAMLSeq } from 'yaml';

import type { EnvironmentMap } from '../env/env-value.js';
import { resolveEnv, type EnvEntry } from '../env/resolve-env.js';
import type { EnvironmentGroup } from '../resources/env-group.js';
import {
  ENV_VAR_FROM_DATABASE_KEY_ORDER,
  ENV_VAR_FROM_GROUP_KEY_ORDER,
  ENV_VAR_GENERATED_KEY_ORDER,
  ENV_VAR_KEY_ORDER,
  ENV_VAR_LITERAL_KEY_ORDER,
  ENV_VAR_SECRET_KEY_ORDER,
  FROM_DATABASE_KEY_ORDER,
} from './key-order.js';
import { mapping } from './mapping.js';

const envVar = (entry: EnvEntry): YAMLMap => {
  switch (entry.form) {
    case 'plain':
      return mapping(ENV_VAR_KEY_ORDER, { key: entry.key, value: entry.value }, undefined);
    case 'literal':
      return mapping(
        ENV_VAR_LITERAL_KEY_ORDER,
        { key: entry.key, value: entry.value, previewValue: entry.previewValue },
        undefined,
      );
    // spec §4: `secret()` is the rename of the sync flag, whose false is what prompts for a value.
    case 'secret':
      return mapping(ENV_VAR_SECRET_KEY_ORDER, { key: entry.key, sync: false }, undefined);
    case 'generated':
      return mapping(
        ENV_VAR_GENERATED_KEY_ORDER,
        { key: entry.key, generateValue: true },
        undefined,
      );
    case 'fromDatabase':
      return mapping(
        ENV_VAR_FROM_DATABASE_KEY_ORDER,
        {
          key: entry.key,
          fromDatabase: mapping(
            FROM_DATABASE_KEY_ORDER,
            { name: entry.reference.name, property: entry.reference.property },
            undefined,
          ),
        },
        undefined,
      );
    case 'fromGroup':
      return mapping(ENV_VAR_FROM_GROUP_KEY_ORDER, { fromGroup: entry.group }, undefined);
  }
};

// An env map with no keys is not an omitted one: it still emits an empty list. A list of no groups
// is not a source at all, so a service that imports none and declares no map writes no envVars key.
export const envVars = (
  env: EnvironmentMap | undefined,
  groups: readonly EnvironmentGroup[] | undefined,
): YAMLSeq | undefined => {
  const names = (groups ?? []).map((group) => group.name);
  if (env === undefined && names.length === 0) return undefined;

  const node = new YAMLSeq();

  for (const entry of resolveEnv(env, names)) node.add(envVar(entry));

  return node;
};
