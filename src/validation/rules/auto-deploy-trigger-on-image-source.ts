import type { AutoDeployTrigger } from '../../enums/auto-deploy-trigger.js';
import type { BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §4.3: autoDeployTrigger has no effect for a service that deploys a prebuilt image.
const triggerOnAnImage = (resource: BlueprintResource): AutoDeployTrigger | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron':
      return resource.config.runtime === 'image' ? resource.config.autoDeployTrigger : undefined;
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const autoDeployTriggerOnImageSource = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] => {
    const trigger = triggerOnAnImage(resource);

    return trigger === undefined
      ? []
      : [
          {
            code: 'AutoDeployTriggerOnImageSource',
            at: { resource: resource.name, field: 'autoDeployTrigger' },
            message: `"${resource.name}" runs a prebuilt image and writes the autoDeployTrigger "${trigger}". Render documents the field as having no effect for a service that deploys a prebuilt Docker image, so the value names no deploy policy a sync applies.`,
          },
        ];
  });
