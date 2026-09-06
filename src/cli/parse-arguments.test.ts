import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import { CommandLineInvalid, parseArguments, type Arguments } from './parse-arguments.js';

const parsed = (argv: readonly string[]): Arguments =>
  parseArguments(argv).unwrap('The arguments under test must parse');

const rejected = (argv: readonly string[]): CommandLineInvalid | undefined => {
  const result = parseArguments(argv);

  return Result.isError(result) ? result.error : undefined;
};

describe('parseArguments', () => {
  it('parses a bare command with no options', () => {
    expect(parsed(['synth'])).toEqual({
      action: 'run',
      command: 'synth',
      file: undefined,
      out: undefined,
      strict: false,
    });
  });

  it('reads --file and --out as separate tokens', () => {
    expect(parsed(['synth', '--file', 'infra/render.ts', '--out', 'infra/render.yaml'])).toEqual({
      action: 'run',
      command: 'synth',
      file: 'infra/render.ts',
      out: 'infra/render.yaml',
      strict: false,
    });
  });

  it('reads --file and --out joined by an equals sign', () => {
    expect(parsed(['synth', '--file=infra/render.ts', '--out=infra/render.yaml'])).toEqual({
      action: 'run',
      command: 'synth',
      file: 'infra/render.ts',
      out: 'infra/render.yaml',
      strict: false,
    });
  });

  it('reads --strict', () => {
    expect(parsed(['synth', '--strict'])).toEqual({
      action: 'run',
      command: 'synth',
      file: undefined,
      out: undefined,
      strict: true,
    });
  });

  it('asks for help when --help appears anywhere', () => {
    expect(parsed(['--help'])).toEqual({ action: 'help' });
    expect(parsed(['-h'])).toEqual({ action: 'help' });
    expect(parsed(['synth', '--file', 'render.ts', '--help'])).toEqual({ action: 'help' });
  });

  it('rejects an empty command line', () => {
    expect(CommandLineInvalid.is(rejected([]))).toBe(true);
    expect(rejected([])?.message).toContain('No command given');
  });

  it('rejects a command it does not know', () => {
    expect(rejected(['plan'])?.message).toContain('Unknown command "plan"');
  });

  it('rejects an option it does not know', () => {
    expect(rejected(['synth', '--colour'])?.message).toContain('Unexpected argument "--colour"');
  });

  it('rejects a positional argument after the command', () => {
    expect(rejected(['synth', 'render.ts'])?.message).toContain('Unexpected argument "render.ts"');
  });

  it('rejects --file with no path', () => {
    expect(rejected(['synth', '--file'])?.message).toContain('--file needs a path');
    expect(rejected(['synth', '--file='])?.message).toContain('--file needs a path');
  });

  it('rejects --file followed by another option rather than swallowing it', () => {
    expect(rejected(['synth', '--file', '--strict'])?.message).toContain('--file needs a path');
  });

  it('rejects --out with no path', () => {
    expect(rejected(['synth', '--out'])?.message).toContain('--out needs a path');
  });

  it('lets the last of a repeated option win', () => {
    expect(parsed(['synth', '--file', 'a.ts', '--file', 'b.ts'])).toEqual({
      action: 'run',
      command: 'synth',
      file: 'b.ts',
      out: undefined,
      strict: false,
    });
  });
});
