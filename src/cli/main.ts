#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';

import { isPanic, Result, type Result as ResultType } from 'better-result';

import type { BlueprintInvalid, BlueprintWriteFailed, ValidationWarning } from '../index.js';
import { writeBlueprint } from '../index.js';
import { discover, type BlueprintFileNotFound } from './discover.js';
import { formatCause, formatIssues, formatWarnings } from './format.js';
import { load, type BlueprintExportMissing, type BlueprintLoadFailed } from './load.js';
import { nodeFileProbe } from './node-file-probe.js';
import { parseArguments, USAGE, type CommandLineInvalid } from './parse-arguments.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;

type CliError =
  | BlueprintExportMissing
  | BlueprintFileNotFound
  | BlueprintInvalid
  | BlueprintLoadFailed
  | BlueprintWriteFailed
  | CommandLineInvalid;

type Outcome =
  | { readonly action: 'help' }
  | {
      readonly action: 'wrote';
      readonly path: string;
      readonly warnings: readonly ValidationWarning[];
      readonly strict: boolean;
    };

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const complain = (text: string): void => {
  if (text !== '') process.stderr.write(`${text}\n`);
};

const execute = (argv: readonly string[], from: string): Promise<ResultType<Outcome, CliError>> =>
  Result.gen(async function* () {
    const args = yield* parseArguments(argv);

    if (args.action === 'help') {
      const help: Outcome = { action: 'help' };

      return Result.ok(help);
    }

    const blueprintPath = yield* Result.await(
      discover({ from, file: args.file, probe: nodeFileProbe }),
    );
    const value = yield* Result.await(load(blueprintPath));
    const target =
      args.out === undefined
        ? join(dirname(blueprintPath), 'render.yaml')
        : resolve(from, args.out);
    const written = yield* Result.await(writeBlueprint(value, { path: target }));
    const wrote: Outcome = {
      action: 'wrote',
      path: written.path,
      warnings: written.warnings,
      strict: args.strict,
    };

    return Result.ok(wrote);
  });

const strictlyFailed = (strict: boolean, warnings: readonly ValidationWarning[]): boolean => {
  if (!strict || warnings.length === 0) return false;

  complain(
    `--strict is on, so ${String(warnings.length)} ${
      warnings.length === 1 ? 'warning fails' : 'warnings fail'
    } this run.`,
  );
  return true;
};

const complete = (outcome: Outcome): number => {
  switch (outcome.action) {
    case 'help':
      say(USAGE);
      return EXIT_OK;

    case 'wrote':
      complain(formatWarnings(outcome.warnings));
      say(`Wrote ${outcome.path}`);
      return strictlyFailed(outcome.strict, outcome.warnings) ? EXIT_FAILED : EXIT_OK;
  }
};

const failed = (error: CliError): number => {
  complain(
    error.match({
      BlueprintExportMissing: (missing) => missing.message,
      BlueprintFileNotFound: (absent) => absent.message,
      BlueprintInvalid: (invalid) => formatIssues(invalid.issues),
      BlueprintLoadFailed: (failure) => `${failure.message}\n  ${formatCause(failure.cause)}`,
      BlueprintWriteFailed: (failure) => `${failure.message}\n  ${formatCause(failure.cause)}`,
      CommandLineInvalid: (invalid) => `${invalid.message}\n\n${USAGE}`,
    }),
  );

  return EXIT_FAILED;
};

const run = async (argv: readonly string[], from: string): Promise<number> => {
  const outcome = await execute(argv, from);

  return outcome.match({ ok: complete, err: failed });
};

try {
  process.exitCode = await run(process.argv.slice(2), process.cwd());
} catch (defect) {
  if (isPanic(defect)) {
    complain(`render-blueprint hit a defect and cannot continue.\n  ${defect.message}`);
  }

  throw defect;
}
