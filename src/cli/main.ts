#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';

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
import { discover, type BlueprintFileNotFound } from './discover.js';
import { formatDrift, formatFailure, formatIssues, formatWarnings } from './format.js';
import {
  load,
  type BlueprintExportInvalid,
  type BlueprintExportMissing,
  type BlueprintLoadFailed,
} from './load.js';
import { belowNodeFloor, NODE_FLOOR } from './node-floor.js';
import { parseArguments, USAGE, type CommandLineInvalid } from './parse-arguments.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_DRIFT = 2;

type CliError =
  | BlueprintExportInvalid
  | BlueprintExportMissing
  | BlueprintFileNotFound
  | BlueprintFileUnreadable
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

const execute = (argv: readonly string[], from: string): Promise<ResultType<Outcome, CliError>> =>
  Result.gen(async function* () {
    const args = yield* parseArguments(argv);

    if (args.action === 'help') {
      const help: Outcome = { action: 'help' };

      return Result.ok(help);
    }

    const blueprintPath = yield* Result.await(
      discover({ from, file: args.file, port: nodeFilePort }),
    );
    const value = yield* Result.await(load(blueprintPath));
    const target =
      args.out === undefined
        ? join(dirname(blueprintPath), 'render.yaml')
        : resolve(from, args.out);

    if (args.command === 'synth') {
      const written = yield* Result.await(writeBlueprint(value, { path: target }));
      const wrote: Outcome = {
        action: 'wrote',
        path: written.path,
        warnings: written.warnings,
        strict: args.strict,
      };

      return Result.ok(wrote);
    }

    const report = yield* Result.await(checkBlueprint(value, { path: target }));
    const checked: Outcome = { action: 'checked', path: target, report, strict: args.strict };

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
    case 'help':
      say(USAGE);
      return EXIT_OK;

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
      CommandLineInvalid: (invalid) => `${invalid.message}\n\n${USAGE}`,
    }),
  );

  return EXIT_FAILED;
};

const run = async (argv: readonly string[], from: string): Promise<number> => {
  if (belowNodeFloor(process.versions.node)) {
    complain(
      `render-blueprint needs Node ${NODE_FLOOR} or newer to strip the types from a TypeScript blueprint; this is Node ${process.versions.node}.`,
    );
    return EXIT_FAILED;
  }

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
