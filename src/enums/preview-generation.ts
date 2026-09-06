import * as z from 'zod';

export const PREVIEW_GENERATIONS = ['automatic', 'manual', 'off'] as const;

export type PreviewGeneration = (typeof PREVIEW_GENERATIONS)[number];

export const previewGenerationSchema: z.ZodEnum<{ [K in PreviewGeneration]: K }> =
  z.enum(PREVIEW_GENERATIONS);
