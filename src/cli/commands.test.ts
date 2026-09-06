import { test as parse } from '@drizzle-team/brocli';
import { describe, expect, it } from 'vitest';

import { commands } from './commands.js';

const [synth, check] = commands(() => Promise.resolve());

describe('commands', () => {
  it('declares synth and check, in that order', () => {
    expect([synth.name, check.name]).toEqual(['synth', 'check']);
  });

  it('describes every command in the list brocli prints', () => {
    expect([synth.shortDesc, check.shortDesc]).toEqual([
      'Synthesize the blueprint and write the YAML file.',
      'Compare the committed YAML file against the blueprint.',
    ]);
  });

  it('describes --file, --out and --strict', () => {
    const described = Object.values(synth.options ?? {}).map((option) => [
      option.config.name,
      option.config.description !== undefined,
    ]);

    expect(described).toEqual([
      ['--file', true],
      ['--out', true],
      ['--strict', true],
    ]);
  });

  it('defaults every option when the command line carries none', async () => {
    expect(await parse(synth, '')).toEqual({
      type: 'handler',
      options: { file: undefined, out: undefined, strict: false },
    });
  });

  it('reads --file and --out as separate tokens', async () => {
    expect(await parse(check, '--file infra/render.ts --out infra/render.yaml')).toEqual({
      type: 'handler',
      options: { file: 'infra/render.ts', out: 'infra/render.yaml', strict: false },
    });
  });

  it('reads --file and --out joined by an equals sign', async () => {
    expect(await parse(check, '--file=infra/render.ts --out=infra/render.yaml')).toEqual({
      type: 'handler',
      options: { file: 'infra/render.ts', out: 'infra/render.yaml', strict: false },
    });
  });

  it('reads --strict as a bare flag', async () => {
    expect(await parse(synth, '--strict')).toEqual({
      type: 'handler',
      options: { file: undefined, out: undefined, strict: true },
    });
  });

  it('rejects an option it does not know', async () => {
    expect((await parse(synth, '--colour')).type).toBe('error');
  });

  it('rejects a positional argument after the command', async () => {
    expect((await parse(synth, 'render.ts')).type).toBe('error');
  });

  it('rejects --file with no path', async () => {
    expect((await parse(synth, '--file')).type).toBe('error');
  });

  it('answers help rather than a handler when --help is asked for', async () => {
    expect(await parse(synth, '--help')).toEqual({ type: 'help' });
  });

  it('answers version rather than a handler when --version is asked for', async () => {
    expect(await parse(check, '--version')).toEqual({ type: 'version' });
  });
});
