#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '@drizzle-team/brocli';
import { isPanic, Result, type Result as ResultType } from 'better-result';

import {
  checkBlueprint,
  nodeFilePort,
  writeBlueprint,
  type BlueprintFileUnreadable,
  type BlueprintInvalid,
  type BlueprintWriteFailed,
  type DriftReport,
  type ValidationWarning,
} from '../index.js';
import {
  CLI_DESCRIPTION,
  CLI_NAME,
  commands,
  type CommandName,
  type CommandOptions,
  type CommandRunner,
} from './commands.js';
import { discover, type BlueprintFileNotFound } from './discover.js';
import { formatDrift, formatFailure, formatIssues, formatWarnings } from './format.js';
import {
  load,
  type BlueprintExportInvalid,
  type BlueprintExportMissing,
  type BlueprintLoadFailed,
} from './load.js';
import { belowNodeFloor, NODE_FLOOR } from './node-floor.js';
import { packageVersion } from './package-version.js';
import type { RunConfig } from './run-config.js';
import { usageTheme } from './usage-theme.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_DRIFT = 2;

// argSource is process.argv, whose first two entries are the executable and this script.
const ARGV_OFFSET = 2;

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

type CliError =
  | BlueprintExportInvalid
  | BlueprintExportMissing
  | BlueprintFileNotFound
  | BlueprintFileUnreadable
  | BlueprintInvalid
  | BlueprintLoadFailed
  | BlueprintWriteFailed;

type Outcome =
  | {
      readonly action: 'wrote';
      readonly path: string;
      readonly warnings: readonly ValidationWarning[];
      readonly strict: boolean;
    }
  | {
      readonly action: 'checked';
      readonly path: string;
      readonly report: DriftReport;
      readonly strict: boolean;
    };

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const complain = (text: string): void => {
  if (text !== '') process.stderr.write(`${text}\n`);
};

const execute = (
  name: CommandName,
  options: CommandOptions,
  from: string,
): Promise<ResultType<Outcome, CliError>> =>
  Result.gen(async function* () {
    const blueprintPath = yield* Result.await(
      discover({ from, file: options.file, port: nodeFilePort }),
    );
    const value = yield* Result.await(load(blueprintPath));
    const target =
      options.out === undefined
        ? join(dirname(blueprintPath), 'render.yaml')
        : resolve(from, options.out);

    if (name === 'synth') {
      const written = yield* Result.await(writeBlueprint(value, { path: target }));
      const wrote: Outcome = {
        action: 'wrote',
        path: written.path,
        warnings: written.warnings,
        strict: options.strict,
      };

      return Result.ok(wrote);
    }

    const report = yield* Result.await(checkBlueprint(value, { path: target }));
    const checked: Outcome = { action: 'checked', path: target, report, strict: options.strict };

    return Result.ok(checked);
  });

const strictExit = (strict: boolean, warnings: readonly ValidationWarning[]): number => {
  if (!strict || warnings.length === 0) return EXIT_OK;

  complain(
    `--strict is on, so ${String(warnings.length)} ${
      warnings.length === 1 ? 'warning fails' : 'warnings fail'
    } this run.`,
  );
  return EXIT_FAILED;
};

const completeCheck = (path: string, report: DriftReport, strict: boolean): number => {
  complain(formatWarnings(report.warnings));

  if (report.status === 'drift') {
    complain(formatDrift(path, report));
    return EXIT_DRIFT;
  }

  say(`${path} is up to date.`);
  return strictExit(strict, report.warnings);
};

const complete = (outcome: Outcome): number => {
  switch (outcome.action) {
    case 'wrote':
      complain(formatWarnings(outcome.warnings));
      say(`Wrote ${outcome.path}`);
      return strictExit(outcome.strict, outcome.warnings);

    case 'checked':
      return completeCheck(outcome.path, outcome.report, outcome.strict);
  }
};

const failed = (error: CliError): number => {
  complain(
    error.match({
      BlueprintExportInvalid: (invalid) => invalid.message,
      BlueprintExportMissing: (missing) => missing.message,
      BlueprintFileNotFound: (absent) => absent.message,
      BlueprintFileUnreadable: formatFailure,
      BlueprintInvalid: (invalid) => formatIssues(invalid.issues),
      BlueprintLoadFailed: formatFailure,
      BlueprintWriteFailed: formatFailure,
    }),
  );

  return EXIT_FAILED;
};

// brocli's run() discards whatever a handler returns, so the exit code the CLI owns is recorded here
// by the handler and by the event handler, and read once run() has settled.
let exitCode: number = EXIT_OK;

const runner: CommandRunner = async (name, options) => {
  exitCode = (await execute(name, options, process.cwd())).match({ ok: complete, err: failed });
};

const showVersion = async (): Promise<void> => {
  say(await packageVersion(MANIFEST, nodeFilePort));
};

const config: RunConfig = {
  name: CLI_NAME,
  description: CLI_DESCRIPTION,
  argSource: process.argv,
  version: showVersion,
  theme: usageTheme(() => {
    exitCode = EXIT_FAILED;
  }),
  noExit: true,
};

const main = async (): Promise<number> => {
  if (belowNodeFloor(process.versions.node)) {
    complain(
      `render-blueprint needs Node ${NODE_FLOOR} or newer to strip the types from a TypeScript blueprint; this is Node ${process.versions.node}.`,
    );
    return EXIT_FAILED;
  }

  // brocli answers a bare command line with the generated help; naming no command is still the usage
  // error it was before brocli, so it keeps exit 1.
  if (process.argv.length <= ARGV_OFFSET) {
    complain(`No command given. Run ${CLI_NAME} --help.`);
    exitCode = EXIT_FAILED;
  }

  await run(commands(runner), config);

  return exitCode;
};

try {
  process.exitCode = await main();
} catch (defect) {
  if (isPanic(defect)) {
    complain(`render-blueprint hit a defect and cannot continue.\n  ${defect.message}`);
  }

  throw defect;
}
