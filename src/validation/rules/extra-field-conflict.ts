import { modeledFields, sourceRuntime, type BlueprintResource } from '../../resources/resource.js';
import { ownedSourceFields, SOURCE_FIELDS } from '../../resources/service-source.js';
import { deprecation, deprecationScope } from '../deprecation.js';
import type { ResourcePath, ValidationIssue } from '../issue.js';
import { conflictingSource } from '../parse-configs.js';

const SOURCE_KEYS: ReadonlySet<string> = new Set(SOURCE_FIELDS);

const conflict = (
  at: ResourcePath,
  key: string,
  runtime: string | undefined,
): ValidationIssue | undefined => {
  if (runtime === undefined || !SOURCE_KEYS.has(key)) return undefined;
  return ownedSourceFields(runtime).includes(key) ? undefined : conflictingSource(at, runtime, key);
};

export const extraFieldConflict = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const extraFields = resource.config.extraFields;
    if (extraFields === undefined) continue;

    const modeled = new Set<string>(modeledFields(resource));
    const runtime = sourceRuntime(resource);

    for (const [key, value] of Object.entries(extraFields)) {
      if (
        !modeled.has(key) ||
        deprecation(key, value, deprecationScope(resource.kind)) !== undefined
      )
        continue;

      const at: ResourcePath = { resource: resource.name, field: `extraFields.${key}` };

      issues.push(
        conflict(at, key, runtime) ?? {
          code: 'ExtraFieldConflict',
          at,
          message: `The library already emits "${key}" for "${resource.name}", so extraFields would overwrite it. Set it through the config instead.`,
        },
      );
    }
  }

  return issues;
};
