import type { BroCliEvent, EventHandler } from '@drizzle-team/brocli';

export type UsageFailure =
  | { readonly failure: 'no-arguments' }
  | { readonly failure: 'flag-before-command'; readonly offender: string }
  | { readonly failure: 'reported' };

export type UsageErrorSink = (failure: UsageFailure) => void;

const HELP_FLAGS = ['--help', '-h'] as const;

const RESERVED_FLAGS = ['--help', '-h', '--version', '-v'] as const;

const BOOLEAN_WORDS = ['0', '1', 'true', 'false'] as const;

const HELP_COMMAND = 'help';

const isOneOf = (words: readonly string[], word: string | undefined): boolean =>
  word !== undefined && words.some((candidate) => candidate === word);

// Mirrors brocli's getCommand (index.js:577), which is what decides there is no command: a reserved
// flag swallows a following boolean word, every other dash argument swallows the next argument
// unless it carries its own '=', and the first argument left standing is the command brocli looks up.
const firstCandidate = (args: readonly string[]): string | undefined => {
  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === undefined) return undefined;

    if (isOneOf(RESERVED_FLAGS, arg)) {
      index += isOneOf(BOOLEAN_WORDS, args[index + 1]?.toLowerCase()) ? 2 : 1;
      continue;
    }

    if (arg.startsWith('-')) {
      index += arg.includes('=') ? 1 : 2;
      continue;
    }

    return arg;
  }

  return undefined;
};

// Mirrors brocli's help guard (index.js:1046): only the first --help or -h counts, and it counts for
// nothing when the argument before it is a dash argument carrying no '=', because brocli reads it as
// that flag's value rather than as a request for help.
const asksForHelpFlag = (args: readonly string[]): boolean => {
  const index = args.findIndex((arg) => isOneOf(HELP_FLAGS, arg));

  if (index === -1) return false;
  if (index === 0) return true;

  const before = args[index - 1];

  return before === undefined || !before.startsWith('-') || before.includes('=');
};

const asksForHelp = (args: readonly string[]): boolean =>
  asksForHelpFlag(args) || firstCandidate(args) === HELP_COMMAND;

const noCommand = (args: readonly string[]): UsageFailure => {
  const offender = args.find((arg) => arg.startsWith('-'));

  return offender === undefined
    ? { failure: 'no-arguments' }
    : { failure: 'flag-before-command', offender };
};

// brocli catches everything a handler throws and reports it as an unknown_error event instead of
// rethrowing. Throwing it back out of the event handler is what lets a defect reach main.ts, the one
// isPanic boundary. Every other error event is brocli's own usage failure: the built-in handler
// prints it to stderr, so this one only records that the run has failed.
export const usageTheme =
  (args: readonly string[], onUsageError: UsageErrorSink): EventHandler =>
  (event: BroCliEvent) => {
    // brocli prints the generated help and reports no error at all whenever it resolves no command,
    // so a flag standing where the command belongs would otherwise succeed. Exit 0 is earned only by
    // a line brocli itself would read as a request for help; every other one is a usage failure.
    if (event.type === 'global_help') {
      if (!asksForHelp(args)) onUsageError(noCommand(args));

      return false;
    }

    if (event.type !== 'error') return false;
    if (event.violation === 'unknown_error') throw event.error;

    onUsageError({ failure: 'reported' });
    return false;
  };
