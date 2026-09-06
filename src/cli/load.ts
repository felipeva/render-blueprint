import { pathToFileURL } from 'node:url';

import {
  Result,
  TaggedError,
  type Result as ResultType,
  type TaggedErrorClass,
} from 'better-result';

import type { Blueprint } from '../index.js';

const BlueprintLoadFailedBase: TaggedErrorClass<'BlueprintLoadFailed'> =
  TaggedError('BlueprintLoadFailed');

export class BlueprintLoadFailed extends BlueprintLoadFailedBase<{
  readonly message: string;
  readonly path: string;
  readonly cause: unknown;
}> {
  constructor(args: { readonly path: string; readonly cause: unknown }) {
    super({
      ...args,
      message: `Could not load ${args.path}; inspect the attached cause.`,
    });
  }
}

const BlueprintExportMissingBase: TaggedErrorClass<'BlueprintExportMissing'> =
  TaggedError('BlueprintExportMissing');

export class BlueprintExportMissing extends BlueprintExportMissingBase<{
  readonly message: string;
  readonly path: string;
}> {
  constructor(args: { readonly path: string }) {
    super({
      ...args,
      message: `${args.path} has no default export; export the blueprint as the module's default.`,
    });
  }
}

interface BlueprintModule {
  readonly default?: Blueprint;
}

const imported = (path: string): Promise<ResultType<BlueprintModule, BlueprintLoadFailed>> =>
  Result.tryPromise({
    // SAFETY: a dynamic import is typed any, and the user's file is unchecked at this boundary.
    // validate parses every resource config at runtime, so a default export that is not a
    // blueprint is reported as validation issues rather than trusted (ADR-0003).
    try: async (): Promise<BlueprintModule> => await import(pathToFileURL(path).href),
    catch: (cause) => new BlueprintLoadFailed({ path, cause }),
  });

export const load = (
  path: string,
): Promise<ResultType<Blueprint, BlueprintLoadFailed | BlueprintExportMissing>> =>
  Result.gen(async function* () {
    const module = yield* Result.await(imported(path));
    const value = module.default;

    return value === undefined
      ? Result.err(new BlueprintExportMissing({ path }))
      : Result.ok(value);
  });
