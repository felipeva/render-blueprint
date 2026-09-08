import { dirname, join, resolve } from 'node:path';

import { Result, type Result as ResultType } from 'better-result';

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
import type { CommandName, CommandOptions } from './commands.js';
import { discover, type BlueprintFileNotFound } from './discover.js';
import {
  load,
  type BlueprintExportInvalid,
  type BlueprintExportMissing,
  type BlueprintLoadFailed,
} from './load.js';

export type CliError =
  | BlueprintExportInvalid
  | BlueprintExportMissing
  | BlueprintFileNotFound
  | BlueprintFileUnreadable
  | BlueprintInvalid
  | BlueprintLoadFailed
  | BlueprintWriteFailed;

export type Outcome =
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

export const execute = (
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
