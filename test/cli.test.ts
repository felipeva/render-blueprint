import { spawn } from 'node:child_process';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Ran {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const root = fileURLToPath(new URL('..', import.meta.url));
const binary = join(root, 'dist', 'cli.js');
const seeds = fileURLToPath(new URL('fixtures/cli/', import.meta.url));

// The seed's import specifier is a placeholder rather than a path: a committed absolute path would
// be one machine's, and a committed relative one would break the moment the seed is copied. The
// test rewrites it to the built entry's file URL, which is what lets the spawned binary resolve
// render-blueprint with no install and no link step.
const PLACEHOLDER = '__RENDER_BLUEPRINT__';

const made: string[] = [];

const spawned = (command: string, args: readonly string[], cwd: string): Promise<Ran> =>
  new Promise((settle) => {
    const child = spawn(command, [...args], { cwd });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      settle({ code: code ?? 1, stdout, stderr });
    });
  });

const directory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'render-blueprint-cli-'));

  made.push(path);
  return path;
};

const seeded = async (name: string): Promise<string> => {
  const path = await directory();
  const seed = join(path, 'render.ts.seed');

  await cp(join(seeds, name), path, { recursive: true });

  const source = await readFile(seed, 'utf8');

  await writeFile(
    join(path, 'render.ts'),
    source.replace(PLACEHOLDER, pathToFileURL(join(root, 'dist', 'index.js')).href),
  );
  await rm(seed);

  return path;
};

const run = (cwd: string, args: readonly string[]): Promise<Ran> =>
  spawned(process.execPath, [binary, ...args], cwd);

beforeAll(async () => {
  const built = await spawned('pnpm', ['build'], root);

  expect(
    built.code,
    `pnpm build must succeed before the binary can be spawned:\n${built.stderr}`,
  ).toBe(0);
  await expect(access(binary)).resolves.toBeUndefined();
}, 180_000);

afterAll(async () => {
  await Promise.all(made.map((path) => rm(path, { recursive: true, force: true })));
});

describe('render-blueprint', () => {
  it('exits 0 and writes the file when synth runs on a valid blueprint', async () => {
    const cwd = await seeded('warned');
    const ran = await run(cwd, ['synth']);

    expect(ran.code).toBe(0);
    expect(await readFile(join(cwd, 'render.yaml'), 'utf8')).toContain('name: api');
  });

  it('exits 0 when check finds the committed file clean', async () => {
    const ran = await run(await seeded('clean'), ['check']);

    expect(ran.code).toBe(0);
  });

  it('exits 2 when check finds the committed file drifted', async () => {
    const ran = await run(await seeded('drifted'), ['check']);

    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain('(normalized)');
    expect(ran.stderr).toContain('Render cannot change these fields in place:');
  });

  it('exits 1 and names the resource when the blueprint is invalid', async () => {
    const ran = await run(await seeded('invalid'), ['check']);

    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain('api.name');
  });

  it('exits 0 on a warning and 1 on the same warning under --strict', async () => {
    const cwd = await seeded('warned');

    expect((await run(cwd, ['check'])).code).toBe(0);

    const strict = await run(cwd, ['check', '--strict']);

    expect(strict.code).toBe(1);
    expect(strict.stderr).toContain('--strict');
  });

  it('exits 1 when there is no blueprint file to find', async () => {
    const ran = await run(await directory(), ['check']);

    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain('No blueprint file found');
  });

  it('exits 1 when --file names a file that is not there', async () => {
    const ran = await run(await seeded('clean'), ['check', '--file', 'absent.ts']);

    expect(ran.code).toBe(1);
  });
});
