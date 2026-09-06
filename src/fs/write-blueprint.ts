import { Result, type Result as ResultType } from 'better-result';

import type { Blueprint } from '../blueprint/blueprint.js';
import { synthesize } from '../synth/synthesize.js';
import type { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import type { ValidationWarning } from '../validation/issue.js';
import type { FileWriter } from './file-port.js';
import { nodeFilePort } from './node-file-port.js';
import type { BlueprintWriteFailed } from './write-text-file.js';

export interface WriteOptions {
  readonly path: string;
  readonly port?: FileWriter;
}

export interface WriteReport {
  readonly path: string;
  readonly warnings: readonly ValidationWarning[];
}

export const writeBlueprint = (
  value: Blueprint,
  options: WriteOptions,
): Promise<ResultType<WriteReport, BlueprintInvalid | BlueprintWriteFailed>> =>
  Result.gen(async function* () {
    const synthesis = yield* synthesize(value);
    const port = options.port ?? nodeFilePort;

    yield* Result.await(port.writeTextFile(options.path, synthesis.yaml));

    return Result.ok({ path: options.path, warnings: synthesis.warnings });
  });
