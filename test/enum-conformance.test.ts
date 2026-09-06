import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { AUTO_DEPLOY_TRIGGERS } from '../src/enums/auto-deploy-trigger.js';
import { ENVIRONMENT_PROTECTIONS } from '../src/enums/environment-protection.js';
import { NETWORK_ISOLATIONS } from '../src/enums/network-isolation.js';
import { SERVER_PLANS } from '../src/enums/plan.js';
import { PREVIEW_GENERATIONS } from '../src/enums/preview-generation.js';
import { REGIONS } from '../src/enums/region.js';
import { ROUTE_TYPES } from '../src/enums/route-type.js';
import { NATIVE_RUNTIMES } from '../src/enums/runtime.js';

type JsonSchemaEnum = readonly (string | number | boolean | null)[] | undefined;

interface RenderSchemaProperty {
  readonly enum?: readonly string[];
  readonly properties?: { readonly [name: string]: RenderSchemaProperty };
}

interface RenderSchemaDefinition {
  readonly enum?: readonly string[];
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
