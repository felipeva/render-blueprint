import type { Result as ResultType } from 'better-result';

import type { BlueprintFileUnreadable } from './read-text-file.js';
import type { BlueprintWriteFailed } from './write-text-file.js';

export interface FileReader {
  readonly readTextFile: (path: string) => Promise<ResultType<string, BlueprintFileUnreadable>>;
}

export interface FileWriter {
  readonly writeTextFile: (
    path: string,
    text: string,
  ) => Promise<ResultType<void, BlueprintWriteFailed>>;
}

export interface FilePort extends FileReader, FileWriter {
  readonly exists: (path: string) => Promise<boolean>;
}
