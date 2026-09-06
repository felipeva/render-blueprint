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

const BlueprintExportInvalidBase: TaggedErrorClass<'BlueprintExportInvalid'> =
  TaggedError('BlueprintExportInvalid');

export class BlueprintExportInvalid extends BlueprintExportInvalidBase<{
  readonly message: string;
  readonly path: string;
  readonly found: string;
}> {
  constructor(args: { readonly path: string; readonly found: string }) {
    super({
      ...args,
      message: `${args.path} default-exports ${args.found}, not a blueprint; export what blueprint({ resources: [...] }) returns.`,
    });
  }
}

interface BlueprintModule {
  readonly default?: Blueprint;
}

const imported = (path: string): Promise<ResultType<BlueprintModule, BlueprintLoadFailed>> =>
  Result.tryPromise({
    // SAFETY: a dynamic import is typed any, and the user's file is unchecked at this boundary.
    // checked() below rejects a default export that is not a resource list, and validate parses
    // every resource config at runtime, so nothing here is trusted for its type (ADR-0003).
    try: async (): Promise<BlueprintModule> => await import(pathToFileURL(path).href),
    catch: (cause) => new BlueprintLoadFailed({ path, cause }),
  });

// Issue #7 owns the blueprint root, so this is the structural floor the CLI needs to hand a value
// to validate, not the root's schema.
const describe = (value: Blueprint): string => {
  if (Array.isArray(value)) return 'an array';
  if (value instanceof Object) return 'an object with no resources array';

  return String(value);
};

const checked = (path: string, value: Blueprint): ResultType<Blueprint, BlueprintExportInvalid> =>
  value instanceof Object && Array.isArray(value.resources)
    ? Result.ok(value)
    : Result.err(new BlueprintExportInvalid({ path, found: describe(value) }));

export const load = (
  path: string,
): Promise<
  ResultType<Blueprint, BlueprintLoadFailed | BlueprintExportMissing | BlueprintExportInvalid>
> =>
  Result.gen(async function* () {
    const module = yield* Result.await(imported(path));
    const value = module.default;

    return value === undefined
      ? Result.err(new BlueprintExportMissing({ path }))
      : checked(path, value);
  });
