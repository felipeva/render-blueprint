import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Result } from 'better-result';
import { afterAll, describe, expect, it } from 'vitest';

import { nodeFilePort } from './node-file-port.js';
import { BlueprintFileUnreadable } from './read-text-file.js';
import { BlueprintWriteFailed } from './write-text-file.js';

const made: string[] = [];

const directory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'render-blueprint-'));

  made.push(path);
  return path;
};

afterAll(async () => {
  await Promise.all(made.map((path) => rm(path, { recursive: true, force: true })));
});

describe('nodeFilePort', () => {
  it('reads back the text it wrote', async () => {
    const path = join(await directory(), 'render.yaml');
    const written = await nodeFilePort.writeTextFile(path, 'services: []\n');

    expect(Result.isOk(written)).toBe(true);
    expect(await readFile(path, 'utf8')).toBe('services: []\n');

    const read = await nodeFilePort.readTextFile(path);

    expect(Result.isOk(read)).toBe(true);
    if (!Result.isOk(read)) return;
    expect(read.value).toBe('services: []\n');
  });

  it('creates the parent directories the path names', async () => {
    const path = join(await directory(), 'infra', 'render', 'render.yaml');
    const written = await nodeFilePort.writeTextFile(path, 'services: []\n');

    expect(Result.isOk(written)).toBe(true);
    expect(await readFile(path, 'utf8')).toBe('services: []\n');
  });

  it('reports a missing file as BlueprintFileUnreadable carrying its cause', async () => {
    const path = join(await directory(), 'absent.yaml');
    const result = await nodeFilePort.readTextFile(path);

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintFileUnreadable.is(result.error)).toBe(true);
    expect(result.error.path).toBe(path);
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it('reports an unwritable path as BlueprintWriteFailed carrying its cause', async () => {
    const path = join(await directory(), 'occupied');
    await writeFile(path, 'a file, not a directory');

    const result = await nodeFilePort.writeTextFile(join(path, 'render.yaml'), 'services: []\n');

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintWriteFailed.is(result.error)).toBe(true);
    expect(result.error.cause).toBeInstanceOf(Error);
  });
});
