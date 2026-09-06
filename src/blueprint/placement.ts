import type { BlueprintResource } from '../resources/resource.js';
import type { Blueprint } from './blueprint.js';

export interface PlacedResource {
  readonly resource: BlueprintResource;
  readonly location: string;
}

const placedAt = (
  location: string,
  resources: readonly BlueprintResource[],
): readonly PlacedResource[] => resources.map((resource) => ({ resource, location }));

export const placement = (value: Blueprint): readonly PlacedResource[] => [
  ...placedAt('the root resource list', value.resources),
  ...value.projects.flatMap((entry) =>
    entry.environments.flatMap((environment) =>
      placedAt(`project "${entry.name}" environment "${environment.name}"`, environment.resources),
    ),
  ),
  ...placedAt('the ungrouped list', value.ungrouped),
];
