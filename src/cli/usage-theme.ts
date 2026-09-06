import type { BroCliEvent, EventHandler } from '@drizzle-team/brocli';

export type UsageErrorSink = () => void;

// brocli catches everything a handler throws and reports it as an unknown_error event instead of
// rethrowing. Throwing it back out of the event handler is what lets a defect reach main.ts, the one
// isPanic boundary. Every other error event is brocli's own usage failure: the built-in handler
// prints it to stderr, so this one only records that the run has failed.
export const usageTheme =
  (onUsageError: UsageErrorSink): EventHandler =>
  (event: BroCliEvent) => {
    if (event.type !== 'error') return false;
    if (event.violation === 'unknown_error') throw event.error;

    onUsageError();
    return false;
  };
