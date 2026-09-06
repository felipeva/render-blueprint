import { YAMLSeq } from 'yaml';

import type { EnvironmentMap } from '../env/env-value.js';
import { resolveEnv } from '../env/resolve-env.js';
import { ENV_VAR_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';

export const envVars = (env: EnvironmentMap): YAMLSeq => {
  const node = new YAMLSeq();

  for (const entry of resolveEnv(env)) {
    node.add(mapping(ENV_VAR_KEY_ORDER, { key: entry.key, value: entry.value }, undefined));
  }

  return node;
};
