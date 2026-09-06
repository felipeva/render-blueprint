import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';
import { parseWebConfig, WEB_SERVICE_FIELDS, type WebService } from './web.js';

export type BlueprintResource = WebService;

export const RESOURCE_KINDS = ['web'] as const;

type ResourceKind = (typeof RESOURCE_KINDS)[number];

type ResourceKindsCoverTheUnion = Expect<Equal<ResourceKind, BlueprintResource['kind']>>;

export const RESOURCE_KINDS_COVER_THE_UNION: true = true satisfies ResourceKindsCoverTheUnion;

export const modeledFields = (resource: BlueprintResource): readonly string[] => {
  switch (resource.kind) {
    case 'web':
      return WEB_SERVICE_FIELDS;
  }
};

const listedResourceSchema = z.object(
  { kind: z.enum(RESOURCE_KINDS) },
  { error: 'A resource is the value a factory returned; this entry in resources is not one.' },
);

export const resourceEntryIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  const result = listedResourceSchema.safeParse(resource);
  return result.success ? [] : result.error.issues;
};

const RESOURCE_NAME_ERROR =
  'A resource name is a non-empty string; Render identifies a resource by its name.';

const resourceNameSchema = z
  .string({ error: RESOURCE_NAME_ERROR })
  .min(1, { error: RESOURCE_NAME_ERROR });

export const parseResourceName = (name: string): z.ZodSafeParseResult<string> =>
  resourceNameSchema.safeParse(name);

export const resourceConfigIssues = (resource: BlueprintResource): readonly z.core.$ZodIssue[] => {
  switch (resource.kind) {
    case 'web': {
      const result = parseWebConfig(resource.config);
      return result.success ? [] : result.error.issues;
    }
  }
};
