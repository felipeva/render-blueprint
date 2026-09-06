import type { JsonObject, JsonValue } from '../json.js';

export const DRIFT_SECTIONS = ['services', 'databases'] as const;

export type DriftSection = (typeof DRIFT_SECTIONS)[number];

// type and region: spec §4.1. runtime: issue #8 and the DX survey appendix, not the spec.
export const IMMUTABLE_SERVICE_FIELDS = ['type', 'runtime', 'region'] as const;

// spec §9
export const IMMUTABLE_DATABASE_FIELDS = [
  'name',
  'region',
  'databaseName',
  'user',
  'postgresMajorVersion',
] as const;

export type ImmutableField =
  | (typeof IMMUTABLE_SERVICE_FIELDS)[number]
  | (typeof IMMUTABLE_DATABASE_FIELDS)[number];

export interface ImmutableFieldChange {
  readonly section: DriftSection;
  readonly resource: string;
  readonly field: ImmutableField;
  readonly committed: string;
  readonly generated: string;
}

const SECTIONS = [
  { section: 'services', fields: IMMUTABLE_SERVICE_FIELDS },
  { section: 'databases', fields: IMMUTABLE_DATABASE_FIELDS },
] as const;

const isJsonArray = (value: JsonValue): value is readonly JsonValue[] => Array.isArray(value);

const asJsonArray = (value: JsonValue): readonly JsonValue[] | undefined =>
  isJsonArray(value) ? value : undefined;

const asJsonObject = (value: JsonValue): JsonObject | undefined =>
  value !== null && !isJsonArray(value) && value instanceof Object ? value : undefined;

const display = (value: JsonValue | undefined): string =>
  value === undefined ? '(absent)' : JSON.stringify(value);

const identity = (entry: JsonObject): string => JSON.stringify(entry['name'] ?? null);

const resourceName = (entry: JsonObject): string => String(entry['name']);

const same = (left: JsonValue | undefined, right: JsonValue | undefined): boolean =>
  left === right ||
  (left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right));

const namedEntries = (
  value: JsonValue | undefined,
  section: DriftSection,
): readonly JsonObject[] => {
  const root = value === undefined ? undefined : asJsonObject(value);
  const listed = root?.[section];
  const items = listed === undefined ? undefined : asJsonArray(listed);

  return (items ?? []).flatMap((item) => {
    const entry = asJsonObject(item);

    return entry === undefined || entry['name'] === undefined ? [] : [entry];
  });
};

const fieldChanges = (
  section: DriftSection,
  fields: readonly ImmutableField[],
  committed: JsonObject,
  generated: JsonObject,
): readonly ImmutableFieldChange[] =>
  fields.flatMap((field) => {
    const value = generated[field];

    // spec §12: an omitted key retains the current value, so a field that went away is not a change.
    if (value === undefined || same(committed[field], value)) return [];

    const change: ImmutableFieldChange = {
      section,
      resource: resourceName(generated),
      field,
      committed: display(committed[field]),
      generated: display(value),
    };

    return [change];
  });

// One dropped and one added resource that agree on every other immutable field is a rename; any
// other leftover is a delete and a create, which the diff already reports as what they are.
const renamed = (
  section: DriftSection,
  fields: readonly ImmutableField[],
  dropped: readonly JsonObject[],
  added: readonly JsonObject[],
): readonly ImmutableFieldChange[] => {
  const from = dropped[0];
  const to = added[0];

  if (dropped.length !== 1 || added.length !== 1 || from === undefined || to === undefined) {
    return [];
  }

  const others = fields.filter((field) => field !== 'name');

  if (!others.every((field) => same(from[field], to[field]))) return [];

  const change: ImmutableFieldChange = {
    section,
    resource: resourceName(to),
    field: 'name',
    committed: display(from['name']),
    generated: display(to['name']),
  };

  return [change];
};

const sectionChanges = (
  section: DriftSection,
  fields: readonly ImmutableField[],
  committed: readonly JsonObject[],
  generated: readonly JsonObject[],
): readonly ImmutableFieldChange[] => {
  const committedByName = new Map(committed.map((entry) => [identity(entry), entry]));
  const generatedNames = new Set(generated.map(identity));

  const matched = generated.flatMap((entry) => {
    const counterpart = committedByName.get(identity(entry));

    return counterpart === undefined ? [] : fieldChanges(section, fields, counterpart, entry);
  });

  if (!fields.includes('name')) return matched;

  return [
    ...matched,
    ...renamed(
      section,
      fields,
      committed.filter((entry) => !generatedNames.has(identity(entry))),
      generated.filter((entry) => !committedByName.has(identity(entry))),
    ),
  ];
};

export const immutableFieldChanges = (
  committed: JsonValue | undefined,
  generated: JsonValue | undefined,
): readonly ImmutableFieldChange[] =>
  SECTIONS.flatMap((entry) =>
    sectionChanges(
      entry.section,
      entry.fields,
      namedEntries(committed, entry.section),
      namedEntries(generated, entry.section),
    ),
  );
