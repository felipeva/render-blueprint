import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { AUTO_DEPLOY_TRIGGERS } from '../src/enums/auto-deploy-trigger.js';
import { DATABASE_PROPERTIES } from '../src/enums/database-property.js';
import { DISK_SIZES_GB } from '../src/enums/disk-size.js';
import { ENVIRONMENT_PROTECTIONS } from '../src/enums/environment-protection.js';
import { MAXMEMORY_POLICIES } from '../src/enums/maxmemory-policy.js';
import { NETWORK_ISOLATIONS } from '../src/enums/network-isolation.js';
import { KEY_VALUE_PLANS, POSTGRES_PLANS, SERVER_PLANS } from '../src/enums/plan.js';
import { POSTGRES_MAJOR_VERSIONS } from '../src/enums/postgres-major-version.js';
import { PREVIEW_GENERATIONS } from '../src/enums/preview-generation.js';
import { REFERENCEABLE_SERVICE_TYPES } from '../src/enums/referenceable-service-type.js';
import { REGIONS } from '../src/enums/region.js';
import { ROUTE_TYPES } from '../src/enums/route-type.js';
import { NATIVE_RUNTIMES } from '../src/enums/runtime.js';
import { SERVICE_PROPERTIES } from '../src/enums/service-property.js';

type JsonSchemaEnum = readonly (string | number | boolean | null)[] | undefined;

interface RenderSchemaProperty {
  readonly enum?: readonly string[];
  readonly properties?: { readonly [name: string]: RenderSchemaProperty };
}

interface RenderSchemaDefinition {
  readonly enum?: readonly string[];
  readonly type?: string;
  readonly minimum?: number;
  readonly properties?: { readonly [name: string]: RenderSchemaProperty };
  readonly allOf?: readonly RenderSchemaProperty[];
}

interface RenderSchema {
  readonly definitions: { readonly [name: string]: RenderSchemaDefinition };
}

const schemaPath = fileURLToPath(new URL('schema/render.yaml.schema.json', import.meta.url));

// SAFETY: JSON.parse returns any. The file is the committed Render schema, refreshed only by
// pnpm schema:refresh; this test reads its `definitions` map, each definition's `enum` array, and
// the `enum` a definition's property carries, and a definition that is missing or carries no enum
// fails an assertion below rather than here.
const renderSchema: RenderSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const published = (name: string): readonly string[] | undefined =>
  renderSchema.definitions[name]?.enum;

const publishedField = (name: string, field: string): readonly string[] | undefined =>
  renderSchema.definitions[name]?.properties?.[field]?.enum;

const converted = (values: readonly string[]): JsonSchemaEnum =>
  z.toJSONSchema(z.enum(values)).enum;

// The environment's own fields sit in an allOf branch, so they carry no named definition.
const publishedInEnvironment = (group: string, field: string): readonly string[] | undefined =>
  (renderSchema.definitions['environment']?.allOf ?? [])
    .map((branch) => branch.properties?.[group]?.properties?.[field]?.enum)
    .find((values) => values !== undefined);

describe('REGIONS', () => {
  it('holds the region enum Render publishes', () => {
    expect(converted(REGIONS)).toEqual(published('region'));
  });
});

describe('SERVER_PLANS', () => {
  it('holds the serverPlan enum Render publishes', () => {
    expect(converted(SERVER_PLANS)).toEqual(published('serverPlan'));
  });
});

describe('AUTO_DEPLOY_TRIGGERS', () => {
  it('holds the autoDeployTrigger enum Render publishes', () => {
    expect(converted(AUTO_DEPLOY_TRIGGERS)).toEqual(published('autoDeployTrigger'));
  });
});

describe('NATIVE_RUNTIMES', () => {
  it('holds a subset of the runtime enum Render publishes', () => {
    const runtimes = published('runtime');

    expect(runtimes).toBeDefined();
    expect(converted(NATIVE_RUNTIMES)).toEqual(
      NATIVE_RUNTIMES.filter((runtime) => (runtimes ?? []).includes(runtime)),
    );
  });
});

describe('ROUTE_TYPES', () => {
  it('holds the route type enum Render publishes', () => {
    expect(converted(ROUTE_TYPES)).toEqual(publishedField('route', 'type'));
  });
});

describe('PREVIEW_GENERATIONS', () => {
  it('holds the previewsGeneration enum Render publishes', () => {
    expect(converted(PREVIEW_GENERATIONS)).toEqual(published('previewsGeneration'));
  });
});

describe('NETWORK_ISOLATIONS', () => {
  it("holds the isolation enum Render publishes on an environment's networking", () => {
    expect(converted(NETWORK_ISOLATIONS)).toEqual(
      publishedInEnvironment('networking', 'isolation'),
    );
  });
});

describe('ENVIRONMENT_PROTECTIONS', () => {
  it("holds the protection enum Render publishes on an environment's permissions", () => {
    expect(converted(ENVIRONMENT_PROTECTIONS)).toEqual(
      publishedInEnvironment('permissions', 'protection'),
    );
  });
});

describe('POSTGRES_PLANS', () => {
  it('holds the postgresPlan enum Render publishes', () => {
    expect(converted(POSTGRES_PLANS)).toEqual(published('postgresPlan'));
  });
});

describe('DATABASE_PROPERTIES', () => {
  it('holds the databaseEnvVarProperty enum Render publishes', () => {
    expect(converted(DATABASE_PROPERTIES)).toEqual(published('databaseEnvVarProperty'));
  });
});

describe('POSTGRES_MAJOR_VERSIONS', () => {
  it('holds the postgresMajorVersion enum Render publishes on a database', () => {
    expect(converted(POSTGRES_MAJOR_VERSIONS)).toEqual(
      publishedField('database', 'postgresMajorVersion'),
    );
  });
});

describe('DISK_SIZES_GB', () => {
  it('holds sizes the published diskSizeGB definition accepts', () => {
    const definition = renderSchema.definitions['diskSizeGB'];

    expect(definition?.type).toBe('integer');
    expect(definition?.enum).toBeUndefined();
    expect(
      DISK_SIZES_GB.filter((size) => !Number.isInteger(size) || size < (definition?.minimum ?? 1)),
    ).toEqual([]);
  });

  it('holds 1 and every multiple of 5 up to its ceiling, in ascending order', () => {
    // spec §8.3: the "1 or a multiple of 5" rule is prose-only, so the schema cannot check it.
    const [first, ...rest] = DISK_SIZES_GB;

    expect(first).toBe(1);
    expect(rest.filter((size, index) => size !== (index + 1) * 5)).toEqual([]);
  });
});

describe('KEY_VALUE_PLANS', () => {
  it('holds the keyValuePlan enum Render publishes', () => {
    expect(converted(KEY_VALUE_PLANS)).toEqual(published('keyValuePlan'));
  });
});

describe('MAXMEMORY_POLICIES', () => {
  it('holds the maxmemoryPolicy enum Render publishes on a Key Value instance', () => {
    expect(converted(MAXMEMORY_POLICIES)).toEqual(publishedField('redisServer', 'maxmemoryPolicy'));
  });
});

describe('SERVICE_PROPERTIES', () => {
  it('holds the serviceEnvVarProperty enum Render publishes', () => {
    expect(converted(SERVICE_PROPERTIES)).toEqual(published('serviceEnvVarProperty'));
  });
});

describe('REFERENCEABLE_SERVICE_TYPES', () => {
  it('holds a subset of the serviceType enum Render publishes', () => {
    const types = published('serviceType');

    expect(types).toBeDefined();
    expect(converted(REFERENCEABLE_SERVICE_TYPES)).toEqual(
      REFERENCEABLE_SERVICE_TYPES.filter((type) => (types ?? []).includes(type)),
    );
  });
});
