import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { AUTO_DEPLOY_TRIGGERS } from '../src/enums/auto-deploy-trigger.js';
import { SERVER_PLANS } from '../src/enums/plan.js';
import { REGIONS } from '../src/enums/region.js';
import { NATIVE_RUNTIMES } from '../src/enums/runtime.js';

type JsonSchemaEnum = readonly (string | number | boolean | null)[] | undefined;

interface RenderSchemaDefinition {
  readonly enum?: readonly string[];
}

interface RenderSchema {
  readonly definitions: { readonly [name: string]: RenderSchemaDefinition };
}

const schemaPath = fileURLToPath(new URL('schema/render.yaml.schema.json', import.meta.url));

// SAFETY: JSON.parse returns any. The file is the committed Render schema, refreshed only by
// pnpm schema:refresh; this test reads its `definitions` map and each definition's `enum` array,
// and a definition that is missing or carries no enum fails an assertion below rather than here.
const renderSchema: RenderSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const published = (name: string): readonly string[] | undefined =>
  renderSchema.definitions[name]?.enum;

const converted = (values: readonly string[]): JsonSchemaEnum =>
  z.toJSONSchema(z.enum(values)).enum;

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
