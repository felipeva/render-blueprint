import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ROOT_SCHEMA_FIELDS } from '../src/blueprint/blueprint.js';
import { CRON_SERVICE_SCHEMA_FIELDS } from '../src/resources/cron.js';
import { ENV_VAR_GROUP_SCHEMA_FIELDS } from '../src/resources/env-group.js';
import { REDIS_SERVER_SCHEMA_FIELDS } from '../src/resources/key-value.js';
import { DATABASE_SCHEMA_FIELDS } from '../src/resources/postgres.js';
import { SERVER_SERVICE_SCHEMA_FIELDS } from '../src/resources/service-fields.js';
import { STATIC_SERVICE_SCHEMA_FIELDS } from '../src/resources/static-site.js';

interface RenderSchemaObject {
  readonly $ref?: string;
  readonly properties?: { readonly [name: string]: RenderSchemaObject };
  readonly additionalProperties?: boolean;
}

interface RenderSchema {
  readonly definitions: { readonly [name: string]: RenderSchemaObject };
  readonly allOf: readonly RenderSchemaObject[];
  readonly unevaluatedProperties?: boolean;
}

const schemaPath = fileURLToPath(new URL('schema/render.yaml.schema.json', import.meta.url));

// SAFETY: JSON.parse returns any. The file is the committed Render schema, refreshed only by
// pnpm schema:refresh; this test reads its `definitions` map, its root `allOf` and the
// `properties` of each, and a definition that is missing or carries no properties fails the
// assertion below.
const renderSchema: RenderSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const referenced = (object: RenderSchemaObject): RenderSchemaObject =>
  object.$ref === undefined
    ? object
    : (renderSchema.definitions[object.$ref.replace('#/definitions/', '')] ?? {});

const publishedProperties = (definition: string): readonly string[] =>
  Object.keys(renderSchema.definitions[definition]?.properties ?? {});

const publishedRootProperties = (): readonly string[] =>
  renderSchema.allOf.flatMap((entry) => Object.keys(referenced(entry).properties ?? {}));

// A tuple is only a constraint while the definition it mirrors stays closed: an open definition
// would turn every warning the allow list raises into a false positive.
const expectClosedDefinition = (tuple: readonly string[], definition: string): void => {
  const order = publishedProperties(definition);

  expect(renderSchema.definitions[definition]?.additionalProperties).toBe(false);
  expect(order).not.toEqual([]);
  expect([...tuple]).toEqual([...order]);
};

const expectClosedRoot = (tuple: readonly string[]): void => {
  const order = publishedRootProperties();

  expect(renderSchema.unevaluatedProperties).toBe(false);
  expect(order).not.toEqual([]);
  expect([...tuple]).toEqual([...order]);
};

describe('SERVER_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the closed serverService definition publishes, in its order', () => {
    expectClosedDefinition(SERVER_SERVICE_SCHEMA_FIELDS, 'serverService');
  });
});

describe('CRON_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the closed cronService definition publishes, in its order', () => {
    expectClosedDefinition(CRON_SERVICE_SCHEMA_FIELDS, 'cronService');
  });
});

describe('STATIC_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the closed staticService definition publishes, in its order', () => {
    expectClosedDefinition(STATIC_SERVICE_SCHEMA_FIELDS, 'staticService');
  });
});

describe('REDIS_SERVER_SCHEMA_FIELDS', () => {
  it('lists every property the closed redisServer definition publishes, in its order', () => {
    expectClosedDefinition(REDIS_SERVER_SCHEMA_FIELDS, 'redisServer');
  });
});

describe('DATABASE_SCHEMA_FIELDS', () => {
  it('lists every property the closed database definition publishes, in its order', () => {
    expectClosedDefinition(DATABASE_SCHEMA_FIELDS, 'database');
  });
});

describe('ENV_VAR_GROUP_SCHEMA_FIELDS', () => {
  it('lists every property the closed envVarGroup definition publishes, in its order', () => {
    expectClosedDefinition(ENV_VAR_GROUP_SCHEMA_FIELDS, 'envVarGroup');
  });
});

describe('ROOT_SCHEMA_FIELDS', () => {
  it('lists every property the closed root publishes, in its order', () => {
    expectClosedRoot(ROOT_SCHEMA_FIELDS);
  });
});
