import type {
  DatabaseReferenceValue,
  ServiceReferenceValue,
} from '../references/reference-value.js';
import type { EnvironmentMap, EnvValue } from './env-value.js';
import type { GeneratedValue } from './generated.js';
import type { LiteralValue } from './literal.js';
import type { SecretValue } from './secret.js';

export interface PlainEnvEntry {
  readonly form: 'plain';
  readonly key: string;
  readonly value: string | number;
}

export interface LiteralEnvEntry {
  readonly form: 'literal';
  readonly key: string;
  readonly value: string | number;
  readonly previewValue: string | number | undefined;
}

export interface SecretEnvEntry {
  readonly form: 'secret';
  readonly key: string;
}

export interface GeneratedEnvEntry {
  readonly form: 'generated';
  readonly key: string;
}

export interface DatabaseEnvEntry {
  readonly form: 'fromDatabase';
  readonly key: string;
  readonly reference: DatabaseReferenceValue;
}

export interface ServiceEnvEntry {
  readonly form: 'fromService';
  readonly key: string;
  readonly reference: ServiceReferenceValue;
}

export interface GroupEnvEntry {
  readonly form: 'fromGroup';
  readonly group: string;
}

export type EnvEntry =
  | PlainEnvEntry
  | LiteralEnvEntry
  | SecretEnvEntry
  | GeneratedEnvEntry
  | DatabaseEnvEntry
  | ServiceEnvEntry
  | GroupEnvEntry;

interface MarkedValue {
  readonly sentinel?: string;
  readonly reference?: string;
}

const marked = (value: EnvValue): MarkedValue =>
  // SAFETY: Object(x) === x holds for every object and for no primitive, so the assertion reads a
  // field only where one exists, and it claims nothing about the branch — the literals do. The
  // test admits a null-prototype object, which the plain-object predicate in json.ts rejects; here
  // that would drop a sentinel into the primitive branch and emit its fields as a nested mapping.
  Object(value) === value ? (value as MarkedValue) : {};

const isLiteral = (value: EnvValue): value is LiteralValue => marked(value).sentinel === 'literal';

const isSecret = (value: EnvValue): value is SecretValue => marked(value).sentinel === 'secret';

const isGenerated = (value: EnvValue): value is GeneratedValue =>
  marked(value).sentinel === 'generated';

const isDatabaseReference = (value: EnvValue): value is DatabaseReferenceValue =>
  marked(value).reference === 'fromDatabase';

const isServiceReference = (value: EnvValue): value is ServiceReferenceValue =>
  marked(value).reference === 'fromService';

const entry = (key: string, value: EnvValue): EnvEntry => {
  if (isLiteral(value))
    return { form: 'literal', key, value: value.value, previewValue: value.previewValue };
  if (isSecret(value)) return { form: 'secret', key };
  if (isGenerated(value)) return { form: 'generated', key };
  if (isDatabaseReference(value)) return { form: 'fromDatabase', key, reference: value };
  if (isServiceReference(value)) return { form: 'fromService', key, reference: value };
  return { form: 'plain', key, value };
};

// spec §6.1: a fromGroup entry carries no key.
export const resolveEnv = (
  env: EnvironmentMap | undefined,
  groups: readonly string[] | undefined,
): readonly EnvEntry[] => [
  ...Object.entries(env ?? {}).map(([key, value]) => entry(key, value)),
  ...(groups ?? []).map((group): GroupEnvEntry => ({ form: 'fromGroup', group })),
];
