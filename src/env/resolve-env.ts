import type { DatabaseReferenceValue } from '../references/reference-value.js';
import type { EnvironmentMap, EnvValue } from './env-value.js';

export interface PlainEnvEntry {
  readonly form: 'plain';
  readonly key: string;
  readonly value: string | number;
}

export interface DatabaseEnvEntry {
  readonly form: 'fromDatabase';
  readonly key: string;
  readonly reference: DatabaseReferenceValue;
}

export type EnvEntry = PlainEnvEntry | DatabaseEnvEntry;

// A reference value is the only branch of EnvValue that is not a primitive.
const isReference = (value: EnvValue): value is DatabaseReferenceValue => value instanceof Object;

const entry = (key: string, value: EnvValue): EnvEntry =>
  isReference(value)
    ? { form: 'fromDatabase', key, reference: value }
    : { form: 'plain', key, value };

export const resolveEnv = (env: EnvironmentMap): readonly EnvEntry[] =>
  Object.entries(env).map(([key, value]) => entry(key, value));
