import type * as z from 'zod';

import type { BlueprintResource } from '../resources/resource.js';
import { parseWebConfig } from '../resources/web.js';
import type { ValidationIssue } from './issue.js';

export interface ParsedConfigs {
  readonly issues: readonly ValidationIssue[];
  readonly accepted: readonly BlueprintResource[];
}

const schemaIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  switch (resource.kind) {
    case 'web': {
      const result = parseWebConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
  }
};

const fieldPath = (path: readonly PropertyKey[]): string =>
  path.length === 0 ? 'config' : path.map((segment) => String(segment)).join('.');

const translate = (
  resource: BlueprintResource,
  issue: z.core.$ZodIssue,
): readonly ValidationIssue[] => {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key): ValidationIssue => ({
      code: 'UnknownField',
      at: { resource: resource.name, field: fieldPath([...issue.path, key]) },
      message: `"${key}" is not a field the library models for "${resource.name}". Declare it through extraFields if Render accepts it and the library does not model it yet.`,
    }));
  }

  return [
    {
      code: 'InvalidConfig',
      at: { resource: resource.name, field: fieldPath(issue.path) },
      message: issue.message,
    },
  ];
};

export const parseConfigs = (resources: readonly BlueprintResource[]): ParsedConfigs => {
  const issues: ValidationIssue[] = [];
  const accepted: BlueprintResource[] = [];

  for (const resource of resources) {
    const found = schemaIssues(resource);
    if (found.length === 0) accepted.push(resource);
    for (const issue of found) issues.push(...translate(resource, issue));
  }

  return { issues, accepted };
};
