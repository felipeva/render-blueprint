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
    expect(failures).toEqual(['reported']);
  });

  it('records nothing when brocli prints the help it generated', async () => {
    const failures: UsageFailure[] = [];

    const ran = await attempt(themed(['boom', '--help'], (failure) => failures.push(failure)));

    expect(ran.panicked).toBe(false);
    expect(failures).toEqual([]);
  });

  it.each([[[]], [['--nope']], [['-x']], [['--nope', 'boom']], [['--', '--nope']]])(
    'records a missing command when %j drives brocli to the global help',
    async (args: readonly string[]) => {
      const failures: UsageFailure[] = [];

      const ran = await attempt(themed(args, (failure) => failures.push(failure)));

      expect(ran.panicked).toBe(false);
      expect(failures).toEqual(['no-command']);
    },
  );

  it.each([[['--help']], [['-h']], [['help']], [['--nope', '--help']]])(
    'records nothing when %j asks for the global help',
    async (args: readonly string[]) => {
      const failures: UsageFailure[] = [];

      const ran = await attempt(themed(args, (failure) => failures.push(failure)));

      expect(ran.panicked).toBe(false);
      expect(failures).toEqual([]);
    },
  );
});
