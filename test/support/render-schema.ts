import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import addFormats from 'ajv-formats';
import { Ajv2020 } from 'ajv/dist/2020.js';

import type { JsonObject, JsonValue } from '../../src/index.js';

export interface SchemaViolation {
  readonly at: string;
  readonly message: string;
}

export type SchemaValidator = (value: JsonValue) => readonly SchemaViolation[];

const schemaPath = fileURLToPath(new URL('../schema/render.yaml.schema.json', import.meta.url));

const compileRenderSchema = (): SchemaValidator => {
  // SAFETY: JSON.parse returns any. The file is the committed Render schema, whose root is a JSON
  // object; if it ever were not, ajv.compile below would reject it and every caller would fail.
  const schema: JsonObject = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ strict: false, allErrors: true });

  // ajv-formats is CommonJS: nodenext types the import as the namespace, .default as the plugin.
  addFormats.default(ajv);

  const compiled = ajv.compile(schema);

  return (value) =>
    compiled(value)
      ? []
      : (compiled.errors ?? []).map((error) => ({
          at: error.instancePath === '' ? '/' : error.instancePath,
          message: error.message ?? error.keyword,
        }));
};

export const renderSchema: SchemaValidator = compileRenderSchema();
