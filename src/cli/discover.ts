import { dirname, join, resolve } from 'node:path';

import {
  Result,
  TaggedError,
  type Result as ResultType,
  type TaggedErrorClass,
} from 'better-result';

import type { FileProbe } from './file-probe.js';

export const BLUEPRINT_FILE_NAMES = ['render.ts', 'render.mts', 'render.js', 'render.mjs'] as const;

export type BlueprintFileName = (typeof BLUEPRINT_FILE_NAMES)[number];

const BlueprintFileNotFoundBase: TaggedErrorClass<'BlueprintFileNotFound'> =
  TaggedError('BlueprintFileNotFound');

const describe = (path: string, names: readonly string[], walked: boolean): string =>
  walked
    ? `No blueprint file found. Looked for ${names.join(', ')} in ${path} and in every directory above it.`
    : `No blueprint file at ${path}.`;

export class BlueprintFileNotFound extends BlueprintFileNotFoundBase<{
  readonly message: string;
  readonly path: string;
  readonly names: readonly string[];
  readonly walked: boolean;
}> {
  constructor(args: {
    readonly path: string;
    readonly names: readonly string[];
    readonly walked: boolean;
  }) {
    super({ ...args, message: describe(args.path, args.names, args.walked) });
  }
}

export interface DiscoverOptions {
  readonly from: string;
  readonly file: string | undefined;
  readonly probe: FileProbe;
}

const walkUp = async (from: string, probe: FileProbe): Promise<string | undefined> => {
  let directory = from;

  for (;;) {
    for (const name of BLUEPRINT_FILE_NAMES) {
      const candidate = join(directory, name);

      if (await probe.exists(candidate)) return candidate;
    }

    const parent = dirname(directory);

    if (parent === directory) return undefined;
    directory = parent;
  }
};

export const discover = async (
  options: DiscoverOptions,
): Promise<ResultType<string, BlueprintFileNotFound>> => {
  const from = resolve(options.from);

  if (options.file !== undefined) {
    const path = resolve(from, options.file);

    return (await options.probe.exists(path))
      ? Result.ok(path)
      : Result.err(new BlueprintFileNotFound({ path, names: [], walked: false }));
  }

  const found = await walkUp(from, options.probe);

  return found === undefined
    ? Result.err(
        new BlueprintFileNotFound({ path: from, names: BLUEPRINT_FILE_NAMES, walked: true }),
      )
    : Result.ok(found);
};
