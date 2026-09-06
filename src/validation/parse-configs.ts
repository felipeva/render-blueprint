import type * as z from 'zod';

import {
  parseResourceName,
  resourceConfigIssues,
  resourceEntryIssues,
  resourceEnvIsCallback,
  resourceEnvIssues,
  type BlueprintResource,
} from '../resources/resource.js';
import { VALIDATION_CODES, type ValidationCode, type ValidationIssue } from './issue.js';

export interface ParsedConfigs {
  readonly issues: readonly ValidationIssue[];
  readonly named: readonly BlueprintResource[];
  readonly accepted: readonly BlueprintResource[];
}

const nameIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = parseResourceName(resource.name);
  return result.success ? [] : result.error.issues;
};

const reportedName = (resource: BlueprintResource): string => String(resource?.name);

const fieldPath = (segments: readonly PropertyKey[]): string =>
  segments.length === 0 ? 'config' : segments.map((segment) => String(segment)).join('.');

const raisedCode = (issue: z.core.$ZodIssueCustom): ValidationCode =>
  VALIDATION_CODES.find((code) => code === String(issue.params?.['validationCode'])) ??
  'InvalidConfig';

export const translate = (
  name: string,
  base: readonly string[],
  issue: z.core.$ZodIssue,
): readonly ValidationIssue[] => {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key): ValidationIssue => ({
      code: 'UnknownField',
      at: { resource: name, field: fieldPath([...base, ...issue.path, key]) },
      message: `"${key}" is not a field the library models for "${name}". Declare it through extraFields if Render accepts it and the library does not model it yet.`,
    }));
  }

  return [
    {
      code: issue.code === 'custom' ? raisedCode(issue) : 'InvalidConfig',
      at: { resource: name, field: fieldPath([...base, ...issue.path]) },
      message: issue.message,
    },
  ];
};

export const parseConfigs = (resources: readonly BlueprintResource[]): ParsedConfigs => {
  const issues: ValidationIssue[] = [];
  const named: BlueprintResource[] = [];
  const accepted: BlueprintResource[] = [];

  for (const resource of resources) {
    const name = reportedName(resource);
    const onEntry = resourceEntryIssues(resource);

    if (onEntry.length > 0) {
      for (const issue of onEntry) issues.push(...translate(name, [], issue));
      continue;
    }

    const onName = nameIssues(resource);
    const onConfig = resourceConfigIssues(resource);
    // BlueprintInvalid carries every issue, so a config that failed elsewhere still has its env map
    // parsed. Only the callback form waits: resolving one runs the author's code against a config
    // the schema already rejected.
    const onEnv =
      onConfig.length === 0 || !resourceEnvIsCallback(resource) ? resourceEnvIssues(resource) : [];

    for (const issue of onName) issues.push(...translate(name, ['name'], issue));
    for (const issue of onConfig) issues.push(...translate(name, [], issue));
    for (const issue of onEnv) issues.push(...translate(name, ['env'], issue));

    if (onName.length === 0) named.push(resource);
    if (onName.length === 0 && onConfig.length === 0 && onEnv.length === 0) accepted.push(resource);
  }

  return { issues, named, accepted };
};
