export type EnvValue = string | number;

export interface EnvironmentMap {
  readonly [key: string]: EnvValue;
}
