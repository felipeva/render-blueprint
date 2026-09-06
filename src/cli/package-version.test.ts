import { Result, type Result as ResultType } from 'better-result';
import { describe, expect, it } from 'vitest';

import { BlueprintFileUnreadable, type FileReader } from '../index.js';
import { packageVersion, UNKNOWN_VERSION } from './package-version.js';

const holding = (text: string): FileReader => ({
  readTextFile: (): Promise<ResultType<string, BlueprintFileUnreadable>> =>
    Promise.resolve(Result.ok(text)),
});

const unreadable: FileReader = {
  readTextFile: (path): Promise<ResultType<string, BlueprintFileUnreadable>> =>
    Promise.resolve(
      Result.err(new BlueprintFileUnreadable({ path, cause: new Error('no such file') })),
    ),
};

describe('packageVersion', () => {
  it('answers the version the manifest names', async () => {
    expect(await packageVersion('package.json', holding('{"version":"1.2.3"}'))).toBe('1.2.3');
  });

  it('answers the unknown marker when the manifest names no version', async () => {
    expect(await packageVersion('package.json', holding('{"name":"render-blueprint"}'))).toBe(
      UNKNOWN_VERSION,
    );
  });

  it('answers the unknown marker when the manifest is not JSON', async () => {
    expect(await packageVersion('package.json', holding('not json'))).toBe(UNKNOWN_VERSION);
  });

  it('answers the unknown marker when the manifest is not an object', async () => {
    expect(await packageVersion('package.json', holding('null'))).toBe(UNKNOWN_VERSION);
  });

  it('answers the unknown marker when the manifest cannot be read', async () => {
    expect(await packageVersion('package.json', unreadable)).toBe(UNKNOWN_VERSION);
  });
});
