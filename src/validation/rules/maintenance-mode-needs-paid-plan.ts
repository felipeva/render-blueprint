import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.1: maintenance mode needs a paid web service instance.
// Render adopts a service by name, and an adopted one may already be paid.
const maintainsOnAFreePlan = (resource: BlueprintResource): boolean => {
  switch (resource.kind) {
    case 'web':
      return resource.config.plan === 'free' && resource.config.maintenanceMode !== undefined;
    case 'privateService':
    case 'worker':
    case 'cron':
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return false;
  }
};

export const maintenanceModeNeedsPaidPlan = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] =>
    maintainsOnAFreePlan(resource)
      ? [
          {
            code: 'MaintenanceModeNeedsPaidPlan',
            at: { resource: resource.name, field: 'maintenanceMode' },
            message: `"${resource.name}" declares maintenance mode and writes the plan "free". Render gives maintenance mode to a paid web service instance, so whether a sync applies the setting, ignores it, or fails is unstated.`,
          },
        ]
      : [],
  );
