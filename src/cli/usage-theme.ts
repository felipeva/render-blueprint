import type { BroCliEvent, EventHandler } from '@drizzle-team/brocli';

export const USAGE_FAILURES = ['no-command', 'reported'] as const;

export type UsageFailure = (typeof USAGE_FAILURES)[number];

export type UsageErrorSink = (failure: UsageFailure) => void;

const HELP_FLAGS = ['--help', '-h'] as const;

const HELP_COMMAND = 'help';

const asksForHelp = (args: readonly string[]): boolean =>
  args[0] === HELP_COMMAND || args.some((arg) => HELP_FLAGS.some((flag) => flag === arg));

// brocli catches everything a handler throws and reports it as an unknown_error event instead of
// rethrowing. Throwing it back out of the event handler is what lets a defect reach main.ts, the one
// isPanic boundary. Every other error event is brocli's own usage failure: the built-in handler
// prints it to stderr, so this one only records that the run has failed.
export const usageTheme =
  (args: readonly string[], onUsageError: UsageErrorSink): EventHandler =>
  (event: BroCliEvent) => {
    // brocli's getCommand reads every argument that starts with '-' as a flag, so a command line
    // whose words are all flags names no command; brocli answers that with the generated help and
    // no error event at all. Only help the caller asked for earns exit 0 there.
    if (event.type === 'global_help') {
      if (!asksForHelp(args)) onUsageError('no-command');

      return false;
    }

    if (event.type !== 'error') return false;
    if (event.violation === 'unknown_error') throw event.error;

    onUsageError('reported');
    return false;
  };
