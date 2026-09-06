import { Result } from 'better-result';

import type { FilePort } from './file-port.js';
import { BlueprintFileUnreadable } from './read-text-file.js';
import { BlueprintWriteFailed } from './write-text-file.js';

export interface MemoryFilePortConfig {
  readonly files?: Readonly<Record<string, string>>;
  readonly unwritablePaths?: readonly string[];
}

export interface MemoryFilePort extends FilePort {
  readonly files: ReadonlyMap<string, string>;
}

export const memoryFilePort = (config?: MemoryFilePortConfig): MemoryFilePort => {
  const files = new Map<string, string>(Object.entries(config?.files ?? {}));
  const unwritablePaths = new Set<string>(config?.unwritablePaths ?? []);

  return {
    files,

    exists: (path) => Promise.resolve(files.has(path)),

    readTextFile: (path) => {
      const text = files.get(path);

      return Promise.resolve(
        text === undefined
          ? Result.err(new BlueprintFileUnreadable({ path, cause: undefined }))
          : Result.ok(text),
      );
    },

    writeTextFile: (path, text) => {
      if (unwritablePaths.has(path)) {
        return Promise.resolve(Result.err(new BlueprintWriteFailed({ path, cause: undefined })));
      }

      files.set(path, text);
      return Promise.resolve(Result.ok());
    },
  };
};
