import {
  Result,
  TaggedError,
  type Result as ResultType,
  type TaggedErrorClass,
} from 'better-result';

export const COMMANDS = ['synth', 'check'] as const;

export type Command = (typeof COMMANDS)[number];

export const USAGE = `Usage: render-blueprint <command> [options]

Commands:
  synth           Synthesize the blueprint and write the YAML file.
  check           Compare the committed YAML file against the blueprint.

Options:
  --file <path>   The blueprint file. Defaults to the nearest render.ts, render.mts,
                  render.js or render.mjs, walking up from the working directory.
  --out <path>    The YAML file to write or compare. Defaults to render.yaml beside
                  the blueprint file.
  --strict        Treat validation warnings as a failure. It applies to both
                  commands: synth still writes the file, then fails.
  --help, -h      Print this message.

Exit codes:
  0               the file was written, or the committed file is clean
  1               the blueprint is invalid, a file could not be read or written, or
                  --strict turned a warning into a failure
  2               the committed file has drifted from the blueprint`;

const CommandLineInvalidBase: TaggedErrorClass<'CommandLineInvalid'> =
  TaggedError('CommandLineInvalid');

export class CommandLineInvalid extends CommandLineInvalidBase<{
  readonly message: string;
}> {}

export type Arguments =
  | { readonly action: 'help' }
  | {
      readonly action: 'run';
      readonly command: Command;
      readonly file: string | undefined;
      readonly out: string | undefined;
      readonly strict: boolean;
    };

type FlagRead =
  | { readonly status: 'absent' }
  | { readonly status: 'missing' }
  | { readonly status: 'value'; readonly value: string };

const ABSENT: FlagRead = { status: 'absent' };
const MISSING: FlagRead = { status: 'missing' };

const isCommand = (value: string): value is Command =>
  COMMANDS.some((command) => command === value);

const readFlag = (argument: string, name: string, queue: string[]): FlagRead => {
  if (argument === name) {
    const next = queue.shift();

    return next === undefined || next.startsWith('-') ? MISSING : { status: 'value', value: next };
  }

  if (!argument.startsWith(`${name}=`)) return ABSENT;

  const inline = argument.slice(name.length + 1);

  return inline === '' ? MISSING : { status: 'value', value: inline };
};

const needsValue = (name: string): CommandLineInvalid =>
  new CommandLineInvalid({ message: `${name} needs a path. Run render-blueprint --help.` });

export const parseArguments = (
  argv: readonly string[],
): ResultType<Arguments, CommandLineInvalid> => {
  if (argv.some((argument) => argument === '--help' || argument === '-h')) {
    const help: Arguments = { action: 'help' };

    return Result.ok(help);
  }

  const [head, ...rest] = argv;

  if (head === undefined) {
    return Result.err(
      new CommandLineInvalid({ message: 'No command given. Run render-blueprint --help.' }),
    );
  }

  if (!isCommand(head)) {
    return Result.err(
      new CommandLineInvalid({
        message: `Unknown command "${head}". The commands are ${COMMANDS.join(' and ')}.`,
      }),
    );
  }

  const queue: string[] = [...rest];
  let file: string | undefined = undefined;
  let out: string | undefined = undefined;
  let strict = false;

  while (queue.length > 0) {
    const argument = queue.shift();

    if (argument === undefined) break;

    if (argument === '--strict') {
      strict = true;
      continue;
    }

    const asFile = readFlag(argument, '--file', queue);

    if (asFile.status === 'missing') return Result.err(needsValue('--file'));
    if (asFile.status === 'value') {
      file = asFile.value;
      continue;
    }

    const asOut = readFlag(argument, '--out', queue);

    if (asOut.status === 'missing') return Result.err(needsValue('--out'));
    if (asOut.status === 'value') {
      out = asOut.value;
      continue;
    }

    return Result.err(
      new CommandLineInvalid({
        message: `Unexpected argument "${argument}". Run render-blueprint --help.`,
      }),
    );
  }

  const parsed: Arguments = { action: 'run', command: head, file, out, strict };

  return Result.ok(parsed);
};
