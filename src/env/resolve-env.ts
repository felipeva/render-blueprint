import type { EnvironmentMap, EnvValue } from "./env-value.js";

export interface EnvEntry {
  readonly key: string;
  readonly value: EnvValue;
}

export const resolveEnv = (env: EnvironmentMap): readonly EnvEntry[] =>
  Object.entries(env).map(([key, value]) => ({ key, value }));
