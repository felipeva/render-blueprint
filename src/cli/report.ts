import type { Result as ResultType } from 'better-result';

import type { DriftReport, ValidationWarning } from '../index.js';
import { CLI_NAME } from './commands.js';
import type { CliError, Outcome } from './execute.js';
import { formatDrift, formatFailure, formatIssues, formatWarnings } from './format.js';
import { NODE_FLOOR } from './node-floor.js';
import type { UsageFailure } from './usage-theme.js';

export const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_DRIFT = 2;

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const complain = (text: string): void => {
  if (text !== '') process.stderr.write(`${text}\n`);
};

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

export const reportOutcome = (result: ResultType<Outcome, CliError>): number =>
  result.match({ ok: complete, err: failed });

export const reportUsage = (usage: UsageFailure): number => {
  switch (usage.failure) {
    case 'no-arguments':
      complain(`No command given. Run ${CLI_NAME} --help.`);
      break;

    case 'flag-before-command':
      complain(
        `'${usage.offender}' is a flag, and flags follow the command. Run ${CLI_NAME} --help.`,
      );
      break;

    case 'reported':
      break;
  }

  return EXIT_FAILED;
};

export const reportBelowNodeFloor = (running: string): number => {
  complain(
    `render-blueprint needs Node ${NODE_FLOOR} or newer to strip the types from a TypeScript blueprint; this is Node ${running}.`,
  );
  return EXIT_FAILED;
};

export const reportVersion = (version: string): void => {
  say(version);
};

export const reportDefect = (message: string): void => {
  complain(`render-blueprint hit a defect and cannot continue.\n  ${message}`);
};
