import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import { memoryFilePort } from '../fs/memory-file-port.js';
import type { BlueprintFileUnreadable } from '../fs/read-text-file.js';
import type { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import { checkBlueprint, type DriftReport } from './check-blueprint.js';

describe('checkBlueprint', () => {
  it('names exactly BlueprintInvalid and BlueprintFileUnreadable in its error lane', () => {
    expectTypeOf(checkBlueprint(blueprint({}), { path: 'render.yaml' })).toEqualTypeOf<
      Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>>
    >();
  });

  it('accepts the in-memory port as its reader', () => {
    expectTypeOf(
      checkBlueprint(blueprint({}), { path: 'render.yaml', port: memoryFilePort() }),
    ).toEqualTypeOf<Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>>>();
  });

  it('rejects options without a path', () => {
    // @ts-expect-error a path is required
    checkBlueprint(blueprint({}), {});
  });

  it('rejects a port that cannot read', () => {
    const port = { writeTextFile: memoryFilePort().writeTextFile };

    // @ts-expect-error a reader is required
    checkBlueprint(blueprint({}), { path: 'render.yaml', port });
  });
});

describe('DriftReport', () => {
  it('hides the diff behind the status discriminant', () => {
    expectTypeOf<DriftReport>().not.toHaveProperty('diff');
    expectTypeOf<DriftReport>().not.toHaveProperty('immutableFieldChanges');
  });

  it('carries the diff and the immutable-field changes once narrowed to drift', () => {
    expectTypeOf<Extract<DriftReport, { status: 'drift' }>>().toHaveProperty('diff');
    expectTypeOf<Extract<DriftReport, { status: 'drift' }>>().toHaveProperty(
      'immutableFieldChanges',
    );
  });

  it('carries the synthesis warnings on both variants', () => {
    expectTypeOf<DriftReport>().toHaveProperty('warnings');
  });
});
