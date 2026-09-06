import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { synthesize, type Blueprint, type JsonObject, type JsonValue } from '../src/index.js';

interface SchemaViolation {
  readonly at: string;
  readonly message: string;
}

type SchemaValidator = (value: JsonValue) => readonly SchemaViolation[];

const schemaPath = fileURLToPath(new URL('schema/render.yaml.schema.json', import.meta.url));
const fixturesPath = fileURLToPath(new URL('fixtures/', import.meta.url));

const compileRenderSchema = (): SchemaValidator => {
  const schema: JsonObject = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const compiled = new Ajv2020({ strict: false, allErrors: true }).compile(schema);

  return (value) =>
    compiled(value)
      ? []
      : (compiled.errors ?? []).map((error) => ({
          at: error.instancePath === '' ? '/' : error.instancePath,
          message: error.message ?? error.keyword,
        }));
};

const renderSchema: SchemaValidator = compileRenderSchema();

const fixtureNames: readonly string[] = readdirSync(fixturesPath, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const emit = async (name: string): Promise<string> => {
  const module: { readonly default: Blueprint } = await import(`./fixtures/${name}/render.ts`);
  return synthesize(module.default).unwrap(`Fixture "${name}" must synthesize`).yaml;
};

describe('renderSchema', () => {
  it("rejects a document Render's JSON Schema forbids", () => {
    const violations = renderSchema({
      services: [{ type: 'web', name: 'api', runtime: 'node', notARenderField: true }],
    });

    expect(violations).not.toEqual([]);
  });
});

describe('synthesize', () => {
  it('has at least one fixture to run', () => {
    expect(fixtureNames.length).toBeGreaterThan(0);
  });

  for (const name of fixtureNames) {
    describe(name, () => {
      it('emits the render.yaml committed beside it', async () => {
        await expect(await emit(name)).toMatchFileSnapshot(`fixtures/${name}/render.yaml`);
      });

      it("emits a document Render's JSON Schema accepts", async () => {
        const parsed: JsonValue = parse(await emit(name));

        expect(renderSchema(parsed)).toEqual([]);
      });
    });
  }
});
