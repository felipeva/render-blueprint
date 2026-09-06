import { ROOT_NAME, type Blueprint } from '../../blueprint/blueprint.js';
import { deprecation } from '../deprecation.js';
import type { ValidationIssue } from '../issue.js';

export const rootDeprecatedField = (value: Blueprint): readonly ValidationIssue[] => {
  const extraFields = value.extraFields;
  if (extraFields === undefined) return [];

  const issues: ValidationIssue[] = [];

  for (const [key, entry] of Object.entries(extraFields)) {
    const retired = deprecation(key, entry, 'root');
    if (retired === undefined) continue;

    issues.push({
      code: 'DeprecatedField',
      at: { resource: ROOT_NAME, field: `extraFields.${key}` },
      message: `Render deprecated "${key}"; use "${retired.replacement}". The escape hatch never emits a retired form.`,
    });
  }

  return issues;
};
