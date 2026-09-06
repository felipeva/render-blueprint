import { BLUEPRINT_FIELDS, ROOT_NAME, type Blueprint } from '../../blueprint/blueprint.js';
import { deprecation } from '../deprecation.js';
import type { ValidationIssue } from '../issue.js';

export const rootExtraFieldConflict = (value: Blueprint): readonly ValidationIssue[] => {
  const extraFields = value.extraFields;
  if (extraFields === undefined) return [];

  const modeled = new Set<string>(BLUEPRINT_FIELDS);
  const issues: ValidationIssue[] = [];

  for (const [key, entry] of Object.entries(extraFields)) {
    if (!modeled.has(key) || deprecation(key, entry, 'root') !== undefined) continue;

    issues.push({
      code: 'ExtraFieldConflict',
      at: { resource: ROOT_NAME, field: `extraFields.${key}` },
      message: `The library already emits "${key}" at the blueprint root, so extraFields would overwrite it. Set it through the blueprint config instead.`,
    });
  }

  return issues;
};
