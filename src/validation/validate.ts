import { Result, type Result as ResultType } from 'better-result';

import type { Blueprint, RootPreviews } from '../blueprint/blueprint.js';
import { placement, type PlacedResource } from '../blueprint/placement.js';
import type { Project } from '../blueprint/project.js';
import type { JsonObject } from '../json.js';
import type { BlueprintResource } from '../resources/resource.js';
import { BlueprintInvalid } from './blueprint-invalid.js';
import type { ValidationWarning } from './issue.js';
import { parseConfigs } from './parse-configs.js';
import { parsePlacement } from './parse-placement.js';
import { branchDisablesPreviews } from './rules/branch-disables-previews.js';
import { danglingReference } from './rules/dangling-reference.js';
import { deprecatedField } from './rules/deprecated-field.js';
import { duplicateEnvKey } from './rules/duplicate-env-key.js';
import { duplicateResourceName } from './rules/duplicate-resource-name.js';
import { envKeyCollision } from './rules/env-key-collision.js';
import { extraFieldConflict } from './rules/extra-field-conflict.js';
import { missingBuildCommand } from './rules/missing-build-command.js';
import { missingStartCommand } from './rules/missing-start-command.js';
import { missingStaticPublishPath } from './rules/missing-static-publish-path.js';
import { resourceInMultipleLocations } from './rules/resource-in-multiple-locations.js';
import { rootDeprecatedField } from './rules/root-deprecated-field.js';
import { rootExtraFieldConflict } from './rules/root-extra-field-conflict.js';
import { secretSkipsPreviews } from './rules/secret-skips-previews.js';
import { unknownServiceEnvVarKey } from './rules/unknown-service-env-var-key.js';

export interface ValidatedBlueprint {
  readonly previews: RootPreviews | undefined;
  readonly resources: readonly BlueprintResource[];
  readonly projects: readonly Project[];
  readonly ungrouped: readonly BlueprintResource[];
  readonly extraFields: JsonObject | undefined;
  readonly warnings: readonly ValidationWarning[];
}

const ROOT_RULES = [rootExtraFieldConflict, rootDeprecatedField] as const;

const PLACEMENT_RULES = [resourceInMultipleLocations] as const;

const NAME_RULES = [duplicateResourceName] as const;

const CONFIG_RULES = [
  duplicateEnvKey,
  envKeyCollision,
  extraFieldConflict,
  deprecatedField,
] as const;

const WARNING_RULES = [
  missingBuildCommand,
  missingStartCommand,
  missingStaticPublishPath,
  unknownServiceEnvVarKey,
] as const;

export const validate = (value: Blueprint): ResultType<ValidatedBlueprint, BlueprintInvalid> => {
  // A blueprint whose own structure did not parse cannot be walked; ADR-0003 defers the rest.
  const structure = parsePlacement(value);
  const placed: readonly PlacedResource[] = structure.length === 0 ? placement(value) : [];
  const parsed = parseConfigs(placed.map((entry) => entry.resource));

  const [first, ...rest] = [
    ...structure,
    ...parsed.issues,
    ...ROOT_RULES.flatMap((rule) => rule(value)),
    ...PLACEMENT_RULES.flatMap((rule) => rule(placed)),
    ...NAME_RULES.flatMap((rule) => rule(parsed.named)),
    ...CONFIG_RULES.flatMap((rule) => rule(parsed.accepted)),
    ...danglingReference(parsed),
  ];

  return first === undefined
    ? Result.ok({
        previews: value.previews,
        resources: value.resources,
        projects: value.projects,
        ungrouped: value.ungrouped,
        extraFields: value.extraFields,
        warnings: [
          ...WARNING_RULES.flatMap((rule) => rule(parsed.accepted)),
          ...branchDisablesPreviews(value.previews, parsed.accepted),
          ...secretSkipsPreviews(value.previews, parsed.accepted),
        ],
      })
    : Result.err(new BlueprintInvalid({ issues: [first, ...rest] }));
};
