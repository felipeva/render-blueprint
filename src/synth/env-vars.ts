import { YAMLMap, YAMLSeq } from 'yaml';

import type { EnvironmentMap } from '../env/env-value.js';
import { resolveEnv, type EnvEntry } from '../env/resolve-env.js';
import {
  ENV_VAR_FROM_DATABASE_KEY_ORDER,
  ENV_VAR_KEY_ORDER,
  FROM_DATABASE_KEY_ORDER,
} from './key-order.js';
import { mapping } from './mapping.js';

const envVar = (entry: EnvEntry): YAMLMap => {
  switch (entry.form) {
    case 'plain':
      return mapping(ENV_VAR_KEY_ORDER, { key: entry.key, value: entry.value }, undefined);
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
  }
};

export const envVars = (env: EnvironmentMap): YAMLSeq => {
  const node = new YAMLSeq();

  for (const entry of resolveEnv(env)) node.add(envVar(entry));

  return node;
};
