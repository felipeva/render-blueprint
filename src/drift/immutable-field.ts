import { asJsonArray, asJsonObject, type JsonObject, type JsonValue } from '../json.js';

export const DRIFT_SECTIONS = ['services', 'databases'] as const;

export type DriftSection = (typeof DRIFT_SECTIONS)[number];

// spec §9/§12: Render replaces the resource rather than updating it when one of these changes.
export const IMMUTABLE_SERVICE_FIELDS = ['type', 'runtime', 'region'] as const;

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

const display = (value: JsonValue | undefined): string =>
  value === undefined ? '(absent)' : String(value);

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
    if (same(committed[field], generated[field])) return [];

    const change: ImmutableFieldChange = {
      section,
      resource: display(generated['name']),
      field,
      committed: display(committed[field]),
      generated: display(generated[field]),
    };

    return [change];
  });

// A resource is paired by name; what is left over on both sides pairs by position, which is the
// only evidence a blueprint gives that a resource was renamed rather than replaced.
const renames = (
  section: DriftSection,
  committed: readonly JsonObject[],
  generated: readonly JsonObject[],
): readonly ImmutableFieldChange[] => {
  const generatedNames = new Set(generated.map((entry) => display(entry['name'])));
  const committedNames = new Set(committed.map((entry) => display(entry['name'])));
  const dropped = committed.filter((entry) => !generatedNames.has(display(entry['name'])));
  const added = generated.filter((entry) => !committedNames.has(display(entry['name'])));

  return dropped.flatMap((entry, index) => {
    const counterpart = added[index];

    if (counterpart === undefined) return [];

    const change: ImmutableFieldChange = {
      section,
      resource: display(counterpart['name']),
      field: 'name',
      committed: display(entry['name']),
      generated: display(counterpart['name']),
    };

    return [change];
  });
};

const sectionChanges = (
  section: DriftSection,
  fields: readonly ImmutableField[],
  committed: readonly JsonObject[],
  generated: readonly JsonObject[],
): readonly ImmutableFieldChange[] => {
  const committedByName = new Map(committed.map((entry) => [display(entry['name']), entry]));

  const matched = generated.flatMap((entry) => {
    const counterpart = committedByName.get(display(entry['name']));

    return counterpart === undefined ? [] : fieldChanges(section, fields, counterpart, entry);
  });

  return fields.includes('name')
    ? [...matched, ...renames(section, committed, generated)]
    : matched;
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
