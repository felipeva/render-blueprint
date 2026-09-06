export const PREVIEW_GENERATIONS = ['automatic', 'manual', 'off'] as const;

export type PreviewGeneration = (typeof PREVIEW_GENERATIONS)[number];
