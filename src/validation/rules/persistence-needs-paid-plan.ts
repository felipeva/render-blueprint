import type { KeyValuePersistenceMode } from '../../enums/key-value-persistence-mode.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §5: data persistence is not available for a free instance, where Render uses off.
const persistsOnAFreePlan = (resource: BlueprintResource): KeyValuePersistenceMode | undefined => {
  switch (resource.kind) {
    case 'keyValue': {
      const mode = resource.config.persistenceMode;
      return resource.config.plan === 'free' && mode !== undefined && mode !== 'off'
        ? mode
        : undefined;
    }
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
    case 'staticSite':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const persistenceNeedsPaidPlan = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] => {
    const mode = persistsOnAFreePlan(resource);

    return mode === undefined
      ? []
      : [
          {
            code: 'PersistenceNeedsPaidPlan',
            at: { resource: resource.name, field: 'persistenceMode' },
            message: `"${resource.name}" writes the plan "free" and the persistenceMode "${mode}". Render documents data persistence as not available for a free instance and uses "off" there, so the mode names a policy the instance cannot keep.`,
          },
        ];
  });
