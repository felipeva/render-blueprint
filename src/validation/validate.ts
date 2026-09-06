import { Result, type Result as ResultType } from 'better-result';

import type { Blueprint } from '../blueprint/blueprint.js';
import type { BlueprintResource } from '../resources/resource.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import type { ValidationWarning } from './issue.js';
import { deprecatedField } from './rules/deprecated-field.js';
import { duplicateEnvKey } from './rules/duplicate-env-key.js';
import { duplicateResourceName } from './rules/duplicate-resource-name.js';
import { extraFieldConflict } from './rules/extra-field-conflict.js';
import { missingBuildCommand } from './rules/missing-build-command.js';
import { missingStartCommand } from './rules/missing-start-command.js';

export interface ValidatedBlueprint {
  readonly resources: readonly BlueprintResource[];
  readonly warnings: readonly ValidationWarning[];
}

const ISSUE_RULES = [
  duplicateResourceName,
  duplicateEnvKey,
  extraFieldConflict,
  deprecatedField,
] as const;

const WARNING_RULES = [missingBuildCommand, missingStartCommand] as const;

export const validate = (value: Blueprint): ResultType<ValidatedBlueprint, BlueprintInvalid> => {
  const [first, ...rest] = ISSUE_RULES.flatMap((rule) => rule(value.resources));

  return first === undefined
    ? Result.ok({
        resources: value.resources,
        warnings: WARNING_RULES.flatMap((rule) => rule(value.resources)),
      })
    : Result.err(new BlueprintInvalid({ issues: [first, ...rest] }));
};
