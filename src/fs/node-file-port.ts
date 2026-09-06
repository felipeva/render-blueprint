import { stat } from 'node:fs/promises';

import type { FilePort } from './file-port.js';
import { readTextFile } from './read-text-file.js';
import { writeTextFile } from './write-text-file.js';

const exists = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

export const nodeFilePort: FilePort = { exists, readTextFile, writeTextFile };
