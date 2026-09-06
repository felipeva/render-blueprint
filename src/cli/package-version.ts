import type { FileReader } from '../index.js';

export const UNKNOWN_VERSION = 'unknown';

interface PackageManifest {
  readonly version?: string;
}

const versionIn = (text: string): string => {
  try {
    // SAFETY: JSON.parse answers any. npm writes package.json, so its "version" is a string there;
    // text that parses to anything else answers undefined for the property and falls back to
    // UNKNOWN_VERSION, and text that does not parse at all lands in the catch.
    const manifest = JSON.parse(text) as PackageManifest;

    return manifest.version ?? UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
};

export const packageVersion = async (path: string, reader: FileReader): Promise<string> => {
  const read = await reader.readTextFile(path);

  return read.match({ ok: versionIn, err: () => UNKNOWN_VERSION });
};
