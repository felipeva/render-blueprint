#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAMES_ZOD = /zod|\$Zod/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const declarations = readdirSync(join(root, 'dist'), { recursive: true })
  .filter((name) => name.endsWith('.d.ts'))
  .map((name) => join('dist', name))
  .toSorted();

if (declarations.length === 0) {
  console.error('check-declarations: dist/ holds no declaration file; run tsdown first.');
  process.exit(1);
}

const offendersIn = (path) =>
  readFileSync(join(root, path), 'utf8')
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => NAMES_ZOD.test(entry.line));

const checked = declarations.map((path) => ({ path, offenders: offendersIn(path) }));

for (const { path, offenders } of checked) {
  if (offenders.length === 0) {
    console.log(`check-declarations: ${path} names no Zod type`);
  } else {
    console.error(
      `check-declarations: ${path} names Zod. The public entries export no schema and no Zod type (ADR-0003).`,
    );
    for (const entry of offenders) console.error(`  ${entry.number}: ${entry.line}`);
  }
}

if (checked.some((result) => result.offenders.length > 0)) process.exit(1);
