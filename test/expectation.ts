export type ReadText = (path: string) => Promise<string | undefined>;

export type WriteText = (path: string, text: string) => Promise<void>;

export type Expected =
  | { readonly present: true; readonly text: string }
  | { readonly present: false };

export type Expectation = (path: string, produced: string) => Promise<Expected>;

export const expectation =
  (read: ReadText, write: WriteText, updating: boolean): Expectation =>
  async (path, produced) => {
    if (updating) {
      await write(path, produced);
    }

    const text = await read(path);

    return text === undefined ? { present: false } : { present: true, text };
  };
