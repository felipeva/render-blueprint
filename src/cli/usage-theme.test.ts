import { command, run } from '@drizzle-team/brocli';
import { isPanic, panic } from 'better-result';
import { describe, expect, it } from 'vitest';

import type { RunConfig } from './run-config.js';
import { usageTheme, type UsageErrorSink, type UsageFailure } from './usage-theme.js';

const DEFECT = 'the handler hit a defect';

const boom = command({
  name: 'boom',
  desc: 'Throws a defect, so the tests can watch it travel.',
  handler: (): never => panic(DEFECT),
});

const argSource = (args: readonly string[]): string[] => ['node', 'render-blueprint', ...args];

const themed = (args: readonly string[], onUsageError: UsageErrorSink): RunConfig => ({
  argSource: argSource(args),
  theme: usageTheme(args, onUsageError),
  noExit: true,
});

interface Ran {
  readonly panicked: boolean;
}

const attempt = async (config: RunConfig): Promise<Ran> => {
  try {
    await run([boom], config);

    return { panicked: false };
  } catch (thrown) {
    return { panicked: isPanic(thrown) };
  }
};

describe('usageTheme', () => {
  it('lets a defect thrown inside a handler escape brocli instead of being swallowed', async () => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed(['boom'], (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(true);
    expect(failures).toEqual([]);
  });

  it('is what carries the defect out: brocli on its own reports it and resolves', async () => {
    const bare: RunConfig = { argSource: argSource(['boom']), noExit: true };

    expect(await attempt(bare)).toEqual({ panicked: false });
  });

  it('records a usage error and leaves the message to brocli', async () => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed(['plan'], (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(false);
    expect(failures).toEqual([{ failure: 'reported' }]);
  });

  it('records nothing when brocli prints the help it generated', async () => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed(['boom', '--help'], (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(false);
    expect(failures).toEqual([]);
  });

  it('records a bare command line as no arguments at all', async () => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed([], (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(false);
    expect(failures).toEqual([{ failure: 'no-arguments' }]);
  });

  it.each([
    [['--nope'], '--nope'],
    [['-x'], '-x'],
    [['--nope', 'boom'], '--nope'],
    [['--', '--nope'], '--'],
    [['--nope', '--version'], '--nope'],
    [['--nope', '--help'], '--nope'],
    [['--nope', '-h'], '--nope'],
    [['--file', '--help'], '--file'],
    [['--', '--help'], '--'],
    [['--nope', 'help'], '--nope'],
  ])('names the flag brocli read where the command belongs in %j', async (args, offender) => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed(args, (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(false);
    expect(failures).toEqual([{ failure: 'flag-before-command', offender }]);
  });

  it.each([[['--help']], [['-h']], [['help']], [['--file=x', 'help']]])(
    'records nothing when %j is the help request brocli reads it as',
    async (args: readonly string[]) => {
      const failures: UsageFailure[] = [];

      const ran = await attempt(themed(args, (failure) => failures.push(failure)));

      expect(ran.panicked).toBe(false);
      expect(failures).toEqual([]);
    },
  );
});
