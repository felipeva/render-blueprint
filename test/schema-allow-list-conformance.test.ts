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
}

interface RenderSchema {
  readonly definitions: { readonly [name: string]: RenderSchemaObject };
  readonly allOf: readonly RenderSchemaObject[];
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

const expectClosedDefinition = (tuple: readonly string[], order: readonly string[]): void => {
  expect(order).not.toEqual([]);
  expect([...tuple]).toEqual([...order]);
};

describe('SERVER_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the serverService definition publishes, in its order', () => {
    expectClosedDefinition(SERVER_SERVICE_SCHEMA_FIELDS, publishedProperties('serverService'));
  });
});

describe('CRON_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the cronService definition publishes, in its order', () => {
    expectClosedDefinition(CRON_SERVICE_SCHEMA_FIELDS, publishedProperties('cronService'));
  });
});

describe('STATIC_SERVICE_SCHEMA_FIELDS', () => {
  it('lists every property the staticService definition publishes, in its order', () => {
    expectClosedDefinition(STATIC_SERVICE_SCHEMA_FIELDS, publishedProperties('staticService'));
  });
});

describe('REDIS_SERVER_SCHEMA_FIELDS', () => {
  it('lists every property the redisServer definition publishes, in its order', () => {
    expectClosedDefinition(REDIS_SERVER_SCHEMA_FIELDS, publishedProperties('redisServer'));
  });
});

describe('DATABASE_SCHEMA_FIELDS', () => {
  it('lists every property the database definition publishes, in its order', () => {
    expectClosedDefinition(DATABASE_SCHEMA_FIELDS, publishedProperties('database'));
  });
});

describe('ENV_VAR_GROUP_SCHEMA_FIELDS', () => {
  it('lists every property the envVarGroup definition publishes, in its order', () => {
    expectClosedDefinition(ENV_VAR_GROUP_SCHEMA_FIELDS, publishedProperties('envVarGroup'));
  });
});

describe('ROOT_SCHEMA_FIELDS', () => {
  it('lists every property the root publishes, in its order', () => {
    expectClosedDefinition(ROOT_SCHEMA_FIELDS, publishedRootProperties());
  });
});
