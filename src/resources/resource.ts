import * as z from 'zod';

import { WEB_SERVICE_FIELDS, type WebService } from './web.js';

export type BlueprintResource = WebService;

export const modeledFields = (resource: BlueprintResource): readonly string[] => {
  switch (resource.kind) {
    case 'web':
      return WEB_SERVICE_FIELDS;
  }
};

const RESOURCE_NAME_ERROR =
  'A resource name is a non-empty string; Render identifies a resource by its name.';

const resourceNameSchema = z
  .string({ error: RESOURCE_NAME_ERROR })
  .min(1, { error: RESOURCE_NAME_ERROR });

export const parseResourceName = (name: string): z.ZodSafeParseResult<string> =>
  resourceNameSchema.safeParse(name);
