import type * as z from 'zod';

import { parseResourceName, type BlueprintResource } from '../resources/resource.js';
import { parseWebConfig } from '../resources/web.js';
import type { ValidationIssue } from './issue.js';

export interface ParsedConfigs {
  readonly issues: readonly ValidationIssue[];
  readonly named: readonly BlueprintResource[];
  readonly accepted: readonly BlueprintResource[];
}

const nameIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = parseResourceName(resource.name);
  return result.success ? [] : result.error.issues;
};

const configIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  switch (resource.kind) {
    case 'web': {
      const result = parseWebConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
  }
};

const fieldPath = (segments: readonly PropertyKey[]): string =>
  segments.length === 0 ? 'config' : segments.map((segment) => String(segment)).join('.');

const translate = (
  resource: BlueprintResource,
  base: readonly string[],
  issue: z.core.$ZodIssue,
): readonly ValidationIssue[] => {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key): ValidationIssue => ({
      code: 'UnknownField',
      at: { resource: resource.name, field: fieldPath([...base, ...issue.path, key]) },
      message: `"${key}" is not a field the library models for "${resource.name}". Declare it through extraFields if Render accepts it and the library does not model it yet.`,
    }));
  }

  return [
    {
      code: 'InvalidConfig',
      at: { resource: resource.name, field: fieldPath([...base, ...issue.path]) },
      message: issue.message,
    },
  ];
};

export const parseConfigs = (resources: readonly BlueprintResource[]): ParsedConfigs => {
  const issues: ValidationIssue[] = [];
  const named: BlueprintResource[] = [];
  const accepted: BlueprintResource[] = [];

  for (const resource of resources) {
    const onName = nameIssues(resource);
    const onConfig = configIssues(resource);

    for (const issue of onName) issues.push(...translate(resource, ['name'], issue));
    for (const issue of onConfig) issues.push(...translate(resource, [], issue));

    if (onName.length === 0) named.push(resource);
    if (onName.length === 0 && onConfig.length === 0) accepted.push(resource);
  }

  return { issues, named, accepted };
};
