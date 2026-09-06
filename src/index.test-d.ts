import type { Result as ResultType } from 'better-result';
import { describe, expectTypeOf, it } from 'vitest';

import {
  blueprint,
  checkBlueprint,
  synthesize,
  writeBlueprint,
  type BlueprintFileUnreadable,
  type BlueprintInvalid,
  type BlueprintWriteFailed,
  type DriftReport,
  type SynthesisReport,
  type WriteReport,
} from './index.js';
import { memoryFilePort } from './testing.js';

describe('synthesize', () => {
  it('names exactly BlueprintInvalid in its error lane at the public entry', () => {
    expectTypeOf(synthesize(blueprint({}))).toEqualTypeOf<
      ResultType<SynthesisReport, BlueprintInvalid>
    >();
  });
});

describe('writeBlueprint', () => {
  it('names exactly its two errors in its error lane at the public entry', () => {
    expectTypeOf(writeBlueprint(blueprint({}), { path: 'render.yaml' })).toEqualTypeOf<
      Promise<ResultType<WriteReport, BlueprintInvalid | BlueprintWriteFailed>>
    >();
  });
});

describe('checkBlueprint', () => {
  it('names exactly its two errors in its error lane at the public entry', () => {
    expectTypeOf(checkBlueprint(blueprint({}), { path: 'render.yaml' })).toEqualTypeOf<
      Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>>
    >();
  });

  it('takes the in-memory port a consumer uses to test its own blueprint', () => {
    expectTypeOf(
      checkBlueprint(blueprint({}), { path: 'render.yaml', port: memoryFilePort() }),
    ).toEqualTypeOf<Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>>>();
  });
});
