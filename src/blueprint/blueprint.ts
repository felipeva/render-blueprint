import * as z from 'zod';

import { previewGenerationSchema, type PreviewGeneration } from '../enums/preview-generation.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import type { BlueprintResource } from '../resources/resource.js';
import type { Project } from './project.js';

export interface RootPreviews {
  readonly generation?: PreviewGeneration;
  readonly expireAfterDays?: number;
}

export interface BlueprintConfig {
  readonly previews?: RootPreviews;
  readonly resources?: readonly BlueprintResource[];
  readonly projects?: readonly Project[];
  readonly ungrouped?: readonly BlueprintResource[];
  readonly extraFields?: JsonObject;
}

export interface Blueprint {
  readonly previews?: RootPreviews | undefined;
  readonly resources: readonly BlueprintResource[];
  readonly projects: readonly Project[];
  readonly ungrouped: readonly BlueprintResource[];
  readonly extraFields?: JsonObject | undefined;
}

export const ROOT_NAME = 'blueprint' as const;

// Emission order follows the schema's root property order, with previews ahead of the resources.
export const BLUEPRINT_FIELDS = [
  'previews',
  'services',
  'databases',
  'projects',
  'ungrouped',
] as const;

const EXPIRE_AFTER_DAYS_ERROR =
  'An expireAfterDays is a whole number of days of at least 1; Render deprovisions a preview environment that goes that long without a push.';

const resourceValueSchema = z.custom<BlueprintResource>();

const projectValueSchema = z.custom<Project>();

const rootPreviewsSchema = z
  .strictObject(
    {
      generation: previewGenerationSchema.exactOptional(),
      expireAfterDays: z
        .int({ error: EXPIRE_AFTER_DAYS_ERROR })
        .min(1, { error: EXPIRE_AFTER_DAYS_ERROR })
        .exactOptional(),
    },
    { error: 'Root previews take a generation and an expireAfterDays.' },
  )
  .readonly();

const blueprintSchema = z
  .strictObject({
    previews: rootPreviewsSchema.optional(),
    resources: z
      .array(resourceValueSchema, {
        error: 'A blueprint holds a list of the resources placed at the root.',
      })
      .readonly(),
    projects: z
      .array(projectValueSchema, {
        error: 'A blueprint holds a list of the projects it defines.',
      })
      .readonly(),
    ungrouped: z
      .array(resourceValueSchema, {
        error: 'A blueprint holds a list of the resources that belong to no environment.',
      })
      .readonly(),
    extraFields: jsonObjectSchema.optional(),
  })
  .readonly();

type BlueprintSchemaMatchesInterface = Expect<Equal<z.infer<typeof blueprintSchema>, Blueprint>>;

export const BLUEPRINT_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies BlueprintSchemaMatchesInterface;

export const parseBlueprint = (value: Blueprint): z.ZodSafeParseResult<Blueprint> =>
  blueprintSchema.safeParse(value);

export const blueprint = (config: BlueprintConfig): Blueprint => ({
  ...config,
  resources: config.resources ?? [],
  projects: config.projects ?? [],
  ungrouped: config.ungrouped ?? [],
});
