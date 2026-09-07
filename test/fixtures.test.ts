import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { synthesize, type Blueprint, type JsonValue } from '../src/index.js';
import { renderSchema } from './render-schema.js';

const fixturesPath = fileURLToPath(new URL('fixtures/', import.meta.url));
const updating = process.env['UPDATE_FIXTURES'] === '1';

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
