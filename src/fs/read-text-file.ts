import { readFile } from 'node:fs/promises';

import {
  Result,
  TaggedError,
  type Result as ResultType,
  type TaggedErrorClass,
} from 'better-result';

const BlueprintFileUnreadableBase: TaggedErrorClass<'BlueprintFileUnreadable'> =
  TaggedError('BlueprintFileUnreadable');

export class BlueprintFileUnreadable extends BlueprintFileUnreadableBase<{
  readonly message: string;
  readonly path: string;
  readonly cause: unknown;
}> {
  constructor(args: { readonly path: string; readonly cause: unknown }) {
    super({
      ...args,
      message: `Could not read ${args.path}; inspect the attached cause.`,
    });
  }
}

export const readTextFile = (path: string): Promise<ResultType<string, BlueprintFileUnreadable>> =>
  Result.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new BlueprintFileUnreadable({ path, cause }),
  });
