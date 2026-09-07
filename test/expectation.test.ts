import { describe, expect, it } from 'vitest';

import { expectation, type ReadText, type WriteText } from './expectation.js';

const PATH = 'expected.yaml';

interface Seam {
  readonly files: Map<string, string>;
  readonly read: ReadText;
  readonly write: WriteText;
}

const seam = (stored?: string): Seam => {
  const files = new Map<string, string>(stored === undefined ? [] : [[PATH, stored]]);

  return {
    files,
    read: (path) => Promise.resolve(files.get(path)),
    write: (path, text) => {
      files.set(path, text);
      return Promise.resolve();
    },
  };
};

describe('expectation', () => {
  it('writes the produced text and returns it back when updating', async () => {
    const { files, read, write } = seam('stale\n');

    const expected = await expectation(read, write, true)(PATH, 'fresh\n');

    expect(expected).toEqual({ present: true, text: 'fresh\n' });
    expect(files.get(PATH)).toBe('fresh\n');
  });

  it('returns the stored text and leaves the file alone when not updating', async () => {
    const { files, read, write } = seam('stale\n');

    const expected = await expectation(read, write, false)(PATH, 'fresh\n');

    expect(expected).toEqual({ present: true, text: 'stale\n' });
    expect(files.get(PATH)).toBe('stale\n');
  });

  it('reports a file that is not there instead of standing in for it', async () => {
    const { read, write } = seam();

    const expected = await expectation(read, write, false)(PATH, 'fresh\n');

    expect(expected).toEqual({ present: false });
  });
});
