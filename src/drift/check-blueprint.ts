import { Result, type Result as ResultType } from 'better-result';

import type { Blueprint } from '../blueprint/blueprint.js';
import type { FileReader } from '../fs/file-port.js';
import { nodeFilePort } from '../fs/node-file-port.js';
import type { BlueprintFileUnreadable } from '../fs/read-text-file.js';
import { synthesize } from '../synth/synthesize.js';
import type { BlueprintInvalid } from '../validation/blueprint-invalid.js';
import type { ValidationWarning } from '../validation/issue.js';
import { diff } from './diff.js';
import { immutableFieldChanges, type ImmutableFieldChange } from './immutable-field.js';
import { normalize, type NormalizedFile } from './normalize.js';

export interface CheckOptions {
  readonly path: string;
  readonly port?: FileReader;
}

export type DriftReport =
  | { readonly status: 'clean'; readonly warnings: readonly ValidationWarning[] }
  | {
      readonly status: 'drift';
      readonly diff: string;
      readonly immutableFieldChanges: readonly ImmutableFieldChange[];
      readonly parseErrors: readonly string[];
      readonly warnings: readonly ValidationWarning[];
    };

const drifted = (
  committed: NormalizedFile,
  generated: NormalizedFile,
  warnings: readonly ValidationWarning[],
): DriftReport => ({
  status: 'drift',
  diff: diff(committed.lines, generated.lines),
  immutableFieldChanges:
    committed.status === 'parsed' && generated.status === 'parsed'
      ? immutableFieldChanges(committed.value, generated.value)
      : [],
  parseErrors: committed.status === 'malformed' ? committed.errors : [],
  warnings,
});

const compare = (
  committed: NormalizedFile,
  generated: NormalizedFile,
  warnings: readonly ValidationWarning[],
): DriftReport =>
  committed.status === 'parsed' && committed.lines.join('\n') === generated.lines.join('\n')
    ? { status: 'clean', warnings }
    : drifted(committed, generated, warnings);

export const checkBlueprint = (
  value: Blueprint,
  options: CheckOptions,
): Promise<ResultType<DriftReport, BlueprintInvalid | BlueprintFileUnreadable>> =>
  Result.gen(async function* () {
    const synthesis = yield* synthesize(value);
    const port = options.port ?? nodeFilePort;
    const committed = yield* Result.await(port.readTextFile(options.path));

    return Result.ok(compare(normalize(committed), normalize(synthesis.yaml), synthesis.warnings));
  });
