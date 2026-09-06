import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
const updating = process.env['UPDATE_FIXTURES'] === '1';

const compileRenderSchema = (): SchemaValidator => {
  // SAFETY: JSON.parse returns any. The file is the committed Render schema, whose root is a JSON
  // object; if it ever were not, ajv.compile below would reject it and every fixture would fail.
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
  .filter((entry) => entry.isDirectory() && existsSync(join(fixturesPath, entry.name, 'render.ts')))
  .map((entry) => entry.name)
  .sort();

const emit = async (name: string): Promise<string> => {
  // SAFETY: a dynamic import is typed any. Every fixture's render.ts default-exports a Blueprint
  // and is type-checked by tsconfig.check.json, so the annotation is verified at the source file.
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
        const produced = await emit(name);
        const expectedPath = join(fixturesPath, name, 'render.yaml');

        if (updating) {
          writeFileSync(expectedPath, produced);
          return;
        }

        expect(
          existsSync(expectedPath),
          `${name}/render.yaml is missing; run pnpm fixtures:update and review the diff`,
        ).toBe(true);
        expect(produced).toBe(readFileSync(expectedPath, 'utf8'));
      });

      it('reads the same under YAML 1.1 as under YAML 1.2', async () => {
        const text = await emit(name);
        const asYaml12: unknown = parse(text, { version: '1.2', schema: 'core' });
        const asYaml11: unknown = parse(text, { version: '1.1' });

        expect(asYaml11).toEqual(asYaml12);
      });

      it("emits a document Render's JSON Schema accepts", async () => {
        // SAFETY: yaml's parse returns any. Its input is the text synthesize just produced, whose
        // leaves are all JsonValue, so it round-trips into JsonValue.
        const parsed: JsonValue = parse(await emit(name));

        expect(renderSchema(parsed)).toEqual([]);
      });
    });
  }
});
