import * as z from 'zod';

import { SOURCE_FIELDS } from '../resources/service-source.js';
import {
  VALIDATION_CODES,
  type ResourcePath,
  type ValidationCode,
  type ValidationIssue,
} from './issue.js';

const fieldPath = (segments: readonly PropertyKey[]): string =>
  segments.length === 0 ? 'config' : segments.map((segment) => String(segment)).join('.');

const raisedCode = (issue: z.core.$ZodIssueCustom): ValidationCode =>
  VALIDATION_CODES.find((code) => code === String(issue.params?.['validationCode'])) ??
  'InvalidConfig';

const SOURCE_KEYS: ReadonlySet<string> = new Set(SOURCE_FIELDS);

// spec §4.2 and §4.3: a service builds from one source, and `runtime` says which.
export const conflictingSource = (
  at: ResourcePath,
  runtime: string,
  key: string,
): ValidationIssue => ({
  code: 'ConflictingSource',
  at,
  message: `"${at.resource}" picks its source with runtime "${runtime}", which does not take "${key}". A native runtime builds the repository, "docker" builds a Dockerfile, and "image" pulls a prebuilt image; drop "${key}" or pick the runtime that reads it.`,
});

const unrecognized = (
  name: string,
  base: readonly string[],
  path: readonly PropertyKey[],
  key: string,
  runtime: string | undefined,
): ValidationIssue =>
  runtime !== undefined && base.length === 0 && path.length === 0 && SOURCE_KEYS.has(key)
    ? conflictingSource({ resource: name, field: fieldPath([key]) }, runtime, key)
    : {
        code: 'UnknownField',
        at: { resource: name, field: fieldPath([...base, ...path, key]) },
        message: `"${key}" is not a field the library models for "${name}". Declare it through extraFields if Render accepts it and the library does not model it yet.`,
      };

export const translateSchemaIssue = (
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

const fieldsReadSchema = z.array(z.string()).readonly();

const reportDepthSchema = z.int().min(0);

// A refinement names the fields it read on the object it sits on, and Zod puts that object's path
// in front of the path the refinement reported at.
export const fieldsRead = (issue: z.core.$ZodIssue): readonly string[] => {
  if (issue.code !== 'custom') return [];

  const fields = fieldsReadSchema.safeParse(issue.params?.['fieldsRead']);
  const depth = reportDepthSchema.safeParse(issue.params?.['reportDepth']);
  if (!fields.success || !depth.success) return [];

  const prefix = issue.path.slice(0, issue.path.length - depth.data);
  return fields.data.map((field) => fieldPath([...prefix, field]));
};
