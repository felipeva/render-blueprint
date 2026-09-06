import { fileURLToPath } from 'node:url';

import { Result } from 'better-result';
import { describe, expect, it } from 'vitest';

import {
  BlueprintExportInvalid,
  BlueprintExportMissing,
  BlueprintLoadFailed,
  load,
} from './load.js';

const at = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

describe('load', () => {
  it('returns the blueprint a file default-exports', async () => {
    const result = await load(at('../../test/fixtures/web-service/render.ts'));

    expect(Result.isOk(result)).toBe(true);
    if (!Result.isOk(result)) return;
    expect(result.value.resources.map((resource) => resource.name)).toEqual(['api']);
  });

  it('reports BlueprintExportMissing when the file has no default export', async () => {
    const path = at('../index.ts');
    const result = await load(path);

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintExportMissing.is(result.error)).toBe(true);
    expect(result.error.path).toBe(path);
  });

  it('reports BlueprintLoadFailed carrying its cause when the file cannot be imported', async () => {
    const path = at('../../test/fixtures/absent/render.ts');
    const result = await load(path);

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintLoadFailed.is(result.error)).toBe(true);
    expect(result.error.path).toBe(path);
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it('reports BlueprintExportInvalid when the default export is not a blueprint', async () => {
    const path = at('../../test/fixtures/cli/export-not-a-blueprint.mjs');
    const result = await load(path);

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintExportInvalid.is(result.error)).toBe(true);
    if (!BlueprintExportInvalid.is(result.error)) return;
    expect(result.error.path).toBe(path);
    expect(result.error.found).toBe('42');
  });

  it('reports BlueprintExportInvalid when resources is not an array', async () => {
    const result = await load(at('../../test/fixtures/cli/export-without-resources.mjs'));

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) return;
    expect(BlueprintExportInvalid.is(result.error)).toBe(true);
    if (!BlueprintExportInvalid.is(result.error)) return;
    expect(result.error.found).toBe('an object with no resources array');
  });
});
