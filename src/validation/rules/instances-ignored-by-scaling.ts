import type { BlueprintResource } from '../../resources/resource.js';
import type { Scaling } from '../../resources/scaling.js';
import type { ValidationWarning } from '../issue.js';

interface ScaledCandidate {
  readonly instances: number;
  readonly scaling: Scaling;
}

// spec §4.8: only the three serverService kinds carry an instance count and autoscaling at all.
const candidate = (resource: BlueprintResource): ScaledCandidate | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker': {
      const instances = resource.config.instances;
      const scaling = resource.config.scaling;
      return instances === undefined || scaling === undefined ? undefined : { instances, scaling };
    }
    case 'cron':
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

// spec §4.5: autoscaling wins over numInstances, so the pair is legal and the count is ignored.
export const instancesIgnoredByScaling = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const found = candidate(resource);
    if (found === undefined) continue;

    warnings.push({
      code: 'InstancesIgnoredByScaling',
      at: { resource: resource.name, field: 'instances' },
      message: `"${resource.name}" asks for ${found.instances} instances and autoscales between ${found.scaling.minInstances} and ${found.scaling.maxInstances}; Render ignores the count when a service autoscales.`,
    });
  }

  return warnings;
};
