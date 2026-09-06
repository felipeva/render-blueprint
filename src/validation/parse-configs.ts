import type * as z from 'zod';

import {
  parseResourceName,
  resourceConfigIssues,
  resourceEntryIssues,
  resourceEnvIsCallback,
  resourceEnvIssues,
  sourceRuntime,
  type BlueprintResource,
} from '../resources/resource.js';
import { SOURCE_FIELDS } from '../resources/service-source.js';
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

const SOURCE_KEYS: ReadonlySet<string> = new Set(SOURCE_FIELDS);

// spec §4.2 and §4.3: a service builds from one source, and `runtime` says which. A key another
// branch owns is the wrong source rather than a field the library does not model, so the message
// names the runtime that rejected it and never offers extraFields, which would emit the conflict.
const conflictingSource = (name: string, runtime: string, key: string): ValidationIssue => ({
  code: 'ConflictingSource',
  at: { resource: name, field: key },
  message: `"${name}" picks its source with runtime "${runtime}", which does not take "${key}". A native runtime builds the repository, "docker" builds a Dockerfile, and "image" pulls a prebuilt image; drop "${key}" or pick the runtime that reads it.`,
});

// The runtime is the enclosing config's own, so only a key at the top of that config can name
// another source: one nested in image or in a group is a field of that object instead.
const unrecognized = (
  name: string,
  base: readonly string[],
  path: readonly PropertyKey[],
  key: string,
  runtime: string | undefined,
): ValidationIssue =>
  runtime !== undefined && base.length === 0 && path.length === 0 && SOURCE_KEYS.has(key)
    ? conflictingSource(name, runtime, key)
    : {
        code: 'UnknownField',
        at: { resource: name, field: fieldPath([...base, ...path, key]) },
        message: `"${key}" is not a field the library models for "${name}". Declare it through extraFields if Render accepts it and the library does not model it yet.`,
      };

export const translate = (
  name: string,
  base: readonly string[],
  issue: z.core.$ZodIssue,
  runtime?: string,
): readonly ValidationIssue[] => {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key): ValidationIssue =>
      unrecognized(name, base, issue.path, key, runtime),
    );
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

    const runtime = sourceRuntime(resource);

    for (const issue of onName) issues.push(...translate(name, ['name'], issue));
    for (const issue of onConfig) issues.push(...translate(name, [], issue, runtime));
    for (const issue of onEnv) issues.push(...translate(name, ['env'], issue));

    if (onName.length === 0) named.push(resource);
    if (onName.length === 0 && onConfig.length === 0 && onEnv.length === 0) accepted.push(resource);
  }

  return { issues, named, accepted };
};
