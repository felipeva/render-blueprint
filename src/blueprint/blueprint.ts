import type { BlueprintResource } from '../resources/resource.js';

export interface BlueprintConfig {
  readonly resources?: readonly BlueprintResource[];
}

export interface Blueprint {
  readonly resources: readonly BlueprintResource[];
}

export const blueprint = (config: BlueprintConfig): Blueprint => ({
  resources: config.resources ?? [],
});
