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

// The literal `reference` field is what selects an env value's form. The sentinels of #5 and the
// service references of #9 each answer with their own literal, so neither can be read as a
// database reference, and a string or a number answers with none.
const isDatabaseReference = (value: EnvValue): value is DatabaseReferenceValue =>
  // SAFETY: Object(x) === x holds for every object and for no primitive, so the assertion reads a
  // field only where one exists, and it claims nothing about the branch — the literal does. The
  // test admits a null-prototype object, which the plain-object predicate in json.ts rejects; here
  // that would drop a reference into the primitive branch and emit its fields as a nested mapping.
  Object(value) === value && (value as DatabaseReferenceValue).reference === 'fromDatabase';

const entry = (key: string, value: EnvValue): EnvEntry =>
  isDatabaseReference(value)
    ? { form: 'fromDatabase', key, reference: value }
    : { form: 'plain', key, value };

export const resolveEnv = (env: EnvironmentMap): readonly EnvEntry[] =>
  Object.entries(env).map(([key, value]) => entry(key, value));
