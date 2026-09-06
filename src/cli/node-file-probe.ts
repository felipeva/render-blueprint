import { stat } from 'node:fs/promises';

import type { FileProbe } from './file-probe.js';

export const nodeFileProbe: FileProbe = {
  exists: async (path) => {
    try {
      return (await stat(path)).isFile();
    } catch {
      return false;
    }
  },
};
