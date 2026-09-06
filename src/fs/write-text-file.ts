import { writeFile } from 'node:fs/promises';

import {
  Result,
  TaggedError,
  type Result as ResultType,
  type TaggedErrorClass,
} from 'better-result';

const BlueprintWriteFailedBase: TaggedErrorClass<'BlueprintWriteFailed'> =
  TaggedError('BlueprintWriteFailed');

export class BlueprintWriteFailed extends BlueprintWriteFailedBase<{
  readonly message: string;
  readonly path: string;
  readonly cause: unknown;
}> {
  constructor(args: { readonly path: string; readonly cause: unknown }) {
    super({
      ...args,
      message: `Could not write ${args.path}; inspect the attached cause.`,
    });
  }
}

export const writeTextFile = (
  path: string,
  text: string,
): Promise<ResultType<void, BlueprintWriteFailed>> =>
  Result.tryPromise({
    try: () => writeFile(path, text, 'utf8'),
    catch: (cause) => new BlueprintWriteFailed({ path, cause }),
  });
