import type { EnvironmentMap } from "../env/env-value.js";
import { resolveEnv } from "../env/resolve-env.js";
import type { JsonObject } from "../json.js";
import { ENV_VAR_KEY_ORDER } from "./key-order.js";
import { mapping } from "./mapping.js";

export const envVars = (env: EnvironmentMap): readonly JsonObject[] =>
  resolveEnv(env).map((entry) =>
    mapping(ENV_VAR_KEY_ORDER, { key: entry.key, value: entry.value }, undefined),
  );
