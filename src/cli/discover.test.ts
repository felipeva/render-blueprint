import { join, resolve } from 'node:path';

import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import type { FilePort } from '../index.js';
import { memoryFilePort } from '../testing.js';
import { BlueprintFileNotFound, discover } from './discover.js';

const root = resolve('/repo');
const nested = join(root, 'apps', 'api');

const portOver = (paths: readonly string[]): FilePort =>
  memoryFilePort({ files: Object.fromEntries(paths.map((path) => [path, ''])) });

const found = async (
  from: string,
  file: string | undefined,
  paths: readonly string[],
): Promise<string> => {
  const result = await discover({ from, file, port: portOver(paths) });

  return result.unwrap('The blueprint under test must be discoverable');
};

describe('discover', () => {
  it('finds the blueprint in the working directory', async () => {
    const path = join(nested, 'render.ts');

    expect(await found(nested, undefined, [path])).toBe(path);
  });

  it('walks up to the first ancestor that holds a blueprint', async () => {
    const path = join(root, 'render.ts');

    expect(await found(nested, undefined, [path])).toBe(path);
  });

  it('stops at the nearest directory when two ancestors hold a blueprint', async () => {
    const near = join(root, 'apps', 'render.ts');

    expect(await found(nested, undefined, [near, join(root, 'render.ts')])).toBe(near);
  });

  it('prefers render.ts over the other names in the same directory', async () => {
    const names = ['render.mjs', 'render.js', 'render.mts', 'render.ts'].map((name) =>
      join(nested, name),
    );

    expect(await found(nested, undefined, names)).toBe(join(nested, 'render.ts'));
  });

  it('accepts render.mts, render.js and render.mjs', async () => {
    for (const name of ['render.mts', 'render.js', 'render.mjs']) {
      const path = join(nested, name);

      expect(await found(nested, undefined, [path])).toBe(path);
    }
  });

  it('resolves --file against the working directory', async () => {
    const path = join(nested, 'infra', 'blueprint.ts');

    expect(await found(nested, join('infra', 'blueprint.ts'), [path])).toBe(path);
  });

  it('keeps an absolute --file as it is', async () => {
    const path = join(root, 'infra', 'blueprint.ts');

    expect(await found(nested, path, [path])).toBe(path);
  });

  it('reports BlueprintFileNotFound naming every name it looked for', async () => {
    const result = await discover({ from: nested, file: undefined, port: portOver([]) });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintFileNotFound.is(result.error)).toBe(true);
    expect(result.error.walked).toBe(true);
    expect(result.error.path).toBe(nested);
    expect(result.error.names).toEqual(['render.ts', 'render.mts', 'render.js', 'render.mjs']);
  });

  it('reports BlueprintFileNotFound naming the path --file gave', async () => {
    const result = await discover({ from: nested, file: 'absent.ts', port: portOver([]) });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(result.error.walked).toBe(false);
    expect(result.error.path).toBe(join(nested, 'absent.ts'));
  });

  it('does not walk up when --file names a missing file', async () => {
    const result = await discover({
      from: nested,
      file: 'render.ts',
      port: portOver([join(root, 'render.ts')]),
    });

    expect(Result.isError(result)).toBe(true);
  });
});
