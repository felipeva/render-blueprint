#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_URL = "https://render.com/schema/render.yaml.json";
const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../test/schema/render.yaml.schema.json",
);

const response = await fetch(SCHEMA_URL);
if (!response.ok) {
  console.error(`refresh-render-schema: ${SCHEMA_URL} answered ${response.status}`);
  process.exit(1);
}

const body = await response.text();
JSON.parse(body);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, body);
console.log(`refresh-render-schema: wrote ${body.length} bytes to ${target}`);
