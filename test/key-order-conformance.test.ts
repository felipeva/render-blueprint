import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUILD_FILTER_FIELDS } from '../src/resources/build-filter.js';
import { CRON_JOB_FIELDS } from '../src/resources/cron.js';
import { DISK_FIELDS } from '../src/resources/disk.js';
import { KEY_VALUE_STORE_FIELDS } from '../src/resources/key-value.js';
import { POSTGRES_DATABASE_FIELDS } from '../src/resources/postgres.js';
import { SERVICE_PREVIEWS_FIELDS } from '../src/resources/previews.js';
import { PRIVATE_SERVICE_FIELDS } from '../src/resources/private-service.js';
import { SCALING_FIELDS } from '../src/resources/scaling.js';
import { STATIC_SITE_FIELDS, STATIC_SITE_PREVIEWS_FIELDS } from '../src/resources/static-site.js';
import { WEB_SERVICE_FIELDS } from '../src/resources/web.js';
import { WORKER_FIELDS } from '../src/resources/worker.js';

interface RenderSchemaObject {
  readonly properties?: { readonly [name: string]: RenderSchemaObject };
}

interface RenderSchema {
  readonly definitions: { readonly [name: string]: RenderSchemaObject };
}

const schemaPath = fileURLToPath(new URL('schema/render.yaml.schema.json', import.meta.url));

// SAFETY: JSON.parse returns any. The file is the committed Render schema, refreshed only by
// pnpm schema:refresh; this test reads its `definitions` map and the `properties` of a definition,
// and a definition that is missing or carries no properties fails the assertion below.
const renderSchema: RenderSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const publishedOrder = (definition: string, nested?: string): readonly string[] => {
  const object = renderSchema.definitions[definition];
  const target = nested === undefined ? object : object?.properties?.[nested];

  return Object.keys(target?.properties ?? {});
};

// A tuple emits a subset of the keys its schema branch carries, in the order that branch lists
// them, so filtering the published order down to the tuple's keys returns the tuple itself.
const expectPublishedOrder = (
  tuple: readonly string[],
  definition: string,
  nested?: string,
): void => {
  const order = publishedOrder(definition, nested);

  expect(order).not.toEqual([]);
  expect(order.filter((key) => tuple.includes(key))).toEqual([...tuple]);
};

describe('WEB_SERVICE_FIELDS', () => {
  it('emits the serverService keys in the order Render publishes them', () => {
    expectPublishedOrder(WEB_SERVICE_FIELDS, 'serverService');
  });
});

describe('PRIVATE_SERVICE_FIELDS', () => {
  it('emits the serverService keys in the order Render publishes them', () => {
    expectPublishedOrder(PRIVATE_SERVICE_FIELDS, 'serverService');
  });
});

describe('WORKER_FIELDS', () => {
  it('emits the serverService keys in the order Render publishes them', () => {
    expectPublishedOrder(WORKER_FIELDS, 'serverService');
  });
});

describe('CRON_JOB_FIELDS', () => {
  it('emits the cronService keys in the order Render publishes them', () => {
    expectPublishedOrder(CRON_JOB_FIELDS, 'cronService');
  });
});

describe('STATIC_SITE_FIELDS', () => {
  it('emits the staticService keys in the order Render publishes them', () => {
    expectPublishedOrder(STATIC_SITE_FIELDS, 'staticService');
  });
});

describe('KEY_VALUE_STORE_FIELDS', () => {
  it('emits the redisServer keys in the order Render publishes them', () => {
    expectPublishedOrder(KEY_VALUE_STORE_FIELDS, 'redisServer');
  });
});

describe('POSTGRES_DATABASE_FIELDS', () => {
  it('emits the database keys in the order Render publishes them', () => {
    expectPublishedOrder(POSTGRES_DATABASE_FIELDS, 'database');
  });
});

describe('DISK_FIELDS', () => {
  it('emits the disk keys in the order Render publishes them', () => {
    expectPublishedOrder(DISK_FIELDS, 'disk');
  });
});

describe('SCALING_FIELDS', () => {
  it('emits the scaling keys in the order Render publishes them', () => {
    expectPublishedOrder(SCALING_FIELDS, 'serverService', 'scaling');
  });
});

describe('BUILD_FILTER_FIELDS', () => {
  it('emits the buildFilter keys in the order Render publishes them', () => {
    expectPublishedOrder(BUILD_FILTER_FIELDS, 'buildFilter');
  });
});

describe('SERVICE_PREVIEWS_FIELDS', () => {
  it('emits the servicePreviews keys in the order Render publishes them', () => {
    expectPublishedOrder(SERVICE_PREVIEWS_FIELDS, 'servicePreviews');
  });
});

describe('STATIC_SITE_PREVIEWS_FIELDS', () => {
  it('emits the staticServicePreviews keys in the order Render publishes them', () => {
    expectPublishedOrder(STATIC_SITE_PREVIEWS_FIELDS, 'staticServicePreviews');
  });
});
