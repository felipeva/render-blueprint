import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import type { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import { memoryFilePort } from './memory-file-port.js';
import { writeBlueprint, type WriteReport } from './write-blueprint.js';
import type { BlueprintWriteFailed } from './write-text-file.js';

describe('writeBlueprint', () => {
  it('names exactly BlueprintInvalid and BlueprintWriteFailed in its error lane', () => {
    expectTypeOf(writeBlueprint(blueprint({}), { path: 'render.yaml' })).toEqualTypeOf<
      Promise<ResultType<WriteReport, BlueprintInvalid | BlueprintWriteFailed>>
    >();
  });

  it('accepts the in-memory port as its writer', () => {
    expectTypeOf(
      writeBlueprint(blueprint({}), { path: 'render.yaml', port: memoryFilePort() }),
    ).toEqualTypeOf<Promise<ResultType<WriteReport, BlueprintInvalid | BlueprintWriteFailed>>>();
  });

  it('rejects options without a path', () => {
    // @ts-expect-error a path is required
    writeBlueprint(blueprint({}), {});
  });

  it('rejects a port that cannot write', () => {
    const port = { readTextFile: memoryFilePort().readTextFile };

    // @ts-expect-error a writer is required
    writeBlueprint(blueprint({}), { path: 'render.yaml', port });
  });
});
