import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUILD_FILTER_FIELDS } from '../src/resources/build-filter.js';
import { CRON_JOB_FIELDS } from '../src/resources/cron.js';
import { DISK_FIELDS } from '../src/resources/disk.js';
import { ENVIRONMENT_GROUP_FIELDS } from '../src/resources/env-group.js';
import { IP_ALLOW_LIST_ENTRY_FIELDS } from '../src/resources/ip-allow-list.js';
import { KEY_VALUE_STORE_FIELDS } from '../src/resources/key-value.js';
import { HIGH_AVAILABILITY_FIELDS, POSTGRES_DATABASE_FIELDS } from '../src/resources/postgres.js';
import { SERVICE_PREVIEWS_FIELDS } from '../src/resources/previews.js';
import { PRIVATE_SERVICE_FIELDS } from '../src/resources/private-service.js';
import { READ_REPLICA_FIELDS } from '../src/resources/read-replica.js';
import { SCALING_FIELDS } from '../src/resources/scaling.js';
import { SERVICE_IMAGE_FIELDS } from '../src/resources/service-source.js';
import {
  HEADER_FIELDS,
  ROUTE_FIELDS,
  STATIC_SITE_FIELDS,
  STATIC_SITE_PREVIEWS_FIELDS,
} from '../src/resources/static-site.js';
import { MAINTENANCE_MODE_FIELDS, WEB_SERVICE_FIELDS } from '../src/resources/web.js';
import { WORKER_FIELDS } from '../src/resources/worker.js';

interface RenderSchemaObject {
  readonly properties?: { readonly [name: string]: RenderSchemaObject };
  readonly items?: RenderSchemaObject;
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

// An ipAllowList is published as an array, so its entry's keys sit under items rather than beside
// the definition's own name.
const publishedItemOrder = (definition: string): readonly string[] =>
  Object.keys(renderSchema.definitions[definition]?.items?.properties ?? {});

// A tuple emits a subset of the keys its schema branch carries, in the order that branch lists
// them, so filtering the published order down to the tuple's keys returns the tuple itself.
const expectOrder = (tuple: readonly string[], order: readonly string[]): void => {
  expect(order).not.toEqual([]);
  expect(order.filter((key) => tuple.includes(key))).toEqual([...tuple]);
};

const expectPublishedOrder = (
  tuple: readonly string[],
  definition: string,
  nested?: string,
): void => {
  expectOrder(tuple, publishedOrder(definition, nested));
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

describe('MAINTENANCE_MODE_FIELDS', () => {
  it('emits the maintenanceMode keys in the order Render publishes them', () => {
    expectPublishedOrder(MAINTENANCE_MODE_FIELDS, 'serverService', 'maintenanceMode');
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

describe('HEADER_FIELDS', () => {
  it('emits the header keys in the order Render publishes them', () => {
    expectPublishedOrder(HEADER_FIELDS, 'header');
  });
});

describe('ROUTE_FIELDS', () => {
  it('emits the route keys in the order Render publishes them', () => {
    expectPublishedOrder(ROUTE_FIELDS, 'route');
  });
});

describe('READ_REPLICA_FIELDS', () => {
  it('emits the readReplica keys in the order Render publishes them', () => {
    expectPublishedOrder(READ_REPLICA_FIELDS, 'readReplica');
  });
});

describe('ENVIRONMENT_GROUP_FIELDS', () => {
  it('emits the envVarGroup keys in the order Render publishes them', () => {
    expectPublishedOrder(ENVIRONMENT_GROUP_FIELDS, 'envVarGroup');
  });
});

describe('SERVICE_IMAGE_FIELDS', () => {
  it('emits the image keys in the order Render publishes them', () => {
    expectPublishedOrder(SERVICE_IMAGE_FIELDS, 'image');
  });
});

describe('HIGH_AVAILABILITY_FIELDS', () => {
  it('emits the highAvailability keys in the order Render publishes them', () => {
    expectPublishedOrder(HIGH_AVAILABILITY_FIELDS, 'database', 'highAvailability');
  });
});

describe('IP_ALLOW_LIST_ENTRY_FIELDS', () => {
  it('emits the ipAllowList entry keys in the order Render publishes them', () => {
    expectOrder(IP_ALLOW_LIST_ENTRY_FIELDS, publishedItemOrder('ipAllowList'));
  });
});
