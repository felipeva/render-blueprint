#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '@drizzle-team/brocli';
import { isPanic } from 'better-result';

import { nodeFilePort } from '../index.js';
import { CLI_DESCRIPTION, CLI_NAME, commands, type CommandRunner } from './commands.js';
import { execute } from './execute.js';
import { belowNodeFloor } from './node-floor.js';
import { packageVersion } from './package-version.js';
import {
  EXIT_OK,
  reportBelowNodeFloor,
  reportDefect,
  reportOutcome,
  reportUsage,
  reportVersion,
} from './report.js';
import type { RunConfig } from './run-config.js';
import { usageTheme, type UsageErrorSink } from './usage-theme.js';

// argSource is process.argv, whose first two entries are the executable and this script.
const ARGV_OFFSET = 2;

const args: readonly string[] = process.argv.slice(ARGV_OFFSET);

const argSource: string[] = [...process.argv.slice(0, ARGV_OFFSET), ...args];

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

// brocli's run() discards whatever a handler returns.
let exitCode: number = EXIT_OK;

const runner: CommandRunner = async (name, options) => {
  exitCode = reportOutcome(await execute(name, options, process.cwd()));
};

const showVersion = async (): Promise<void> => {
  reportVersion(await packageVersion(MANIFEST, nodeFilePort));
};

const onUsageError: UsageErrorSink = (usage) => {
  exitCode = reportUsage(usage);
};

const config: RunConfig = {
  name: CLI_NAME,
  description: CLI_DESCRIPTION,
  argSource,
  version: showVersion,
  theme: usageTheme(args, onUsageError),
  noExit: true,
};

const main = async (): Promise<number> => {
  if (belowNodeFloor(process.versions.node)) return reportBelowNodeFloor(process.versions.node);

  await run(commands(runner), config);

  return exitCode;
};

try {
  process.exitCode = await main();
} catch (defect) {
  if (isPanic(defect)) {
    reportDefect(defect.message);
  }

  throw defect;
}
