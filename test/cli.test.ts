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

interface Manifest {
  readonly version: string;
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

  it('exits 0 and writes the file when the blueprint imports a second .ts file', async () => {
    const cwd = await seeded('split');
    const ran = await run(cwd, ['synth']);

    expect(ran.code, ran.stderr).toBe(0);
    expect(await readFile(join(cwd, 'render.yaml'), 'utf8')).toBe(
      await readFile(join(seeds, 'split', 'expected.yaml'), 'utf8'),
    );
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

  it('exits 1 under --strict on a build filter an image-sourced service cannot use', async () => {
    const cwd = await seeded('build-filter-image');
    const ran = await run(cwd, ['synth']);

    expect(ran.code).toBe(0);
    expect(ran.stderr).toContain('warning api.buildFilter:');

    const strict = await run(cwd, ['synth', '--strict']);

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

  it('exits 1 and reports the panic when a defect escapes a command handler', async () => {
    const ran = await run(await seeded('defective'), ['check']);

    expect(ran.code).not.toBe(0);
    expect(ran.stderr).toContain('render-blueprint hit a defect and cannot continue.');
    expect(ran.stderr).toContain('Panic');
  });

  it('exits 1 on a usage error and names the offender on stderr', async () => {
    const cwd = await seeded('clean');

    const unknownCommand = await run(cwd, ['plan']);

    expect(unknownCommand.code).toBe(1);
    expect(unknownCommand.stderr).toContain("Unknown command: 'plan'");

    const unknownOption = await run(cwd, ['check', '--colour']);

    expect(unknownOption.code).toBe(1);
    expect(unknownOption.stderr).toContain('--colour');

    const missingValue = await run(cwd, ['check', '--file']);

    expect(missingValue.code).toBe(1);
    expect(missingValue.stderr).toContain('--file');
  });

  it('exits 1 and asks for a command when the command line is bare', async () => {
    const ran = await run(await seeded('clean'), []);

    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain('No command given');
  });

  it('prints the generated help for the cli and for both commands', async () => {
    const cwd = await seeded('clean');

    const cli = await run(cwd, ['--help']);

    expect(cli.code).toBe(0);
    expect(cli.stdout).toContain('synth');
    expect(cli.stdout).toContain('check');

    for (const command of ['synth', 'check']) {
      const help = await run(cwd, [command, '--help']);

      expect(help.code).toBe(0);
      expect(help.stdout).toContain(`render-blueprint ${command} [flags]`);
      expect(help.stdout).toContain('--file string');
      expect(help.stdout).toContain('--out string');
      expect(help.stdout).toContain('--strict');
    }
  });

  it('prints the version the package manifest names', async () => {
    // SAFETY: JSON.parse answers any. This is the repository's own package.json, whose "version" npm
    // writes and whose absence would fail the build long before this assertion runs.
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Manifest;
    const ran = await run(await seeded('clean'), ['--version']);

    expect(ran.code).toBe(0);
    expect(ran.stdout.trim()).toBe(manifest.version);
  });
});
