#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAMES_ZOD = /zod|\$Zod/;
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.d.ts');

const offenders = readFileSync(target, 'utf8')
  .split('\n')
  .map((line, index) => ({ line, number: index + 1 }))
  .filter((entry) => NAMES_ZOD.test(entry.line));

if (offenders.length > 0) {
  console.error(
    'check-declarations: dist/index.d.ts names Zod. The public entry exports no schema and no Zod type (ADR-0003).',
  );
  for (const entry of offenders) console.error(`  ${entry.number}: ${entry.line}`);
  process.exit(1);
}

console.log('check-declarations: dist/index.d.ts names no Zod type');
