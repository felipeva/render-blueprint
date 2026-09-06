import type { FilePort } from './file-port.js';
import { readTextFile } from './read-text-file.js';
import { writeTextFile } from './write-text-file.js';

export const nodeFilePort: FilePort = { readTextFile, writeTextFile };
