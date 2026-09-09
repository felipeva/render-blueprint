import { resolveEnv } from '../../env/resolve-env.js';
import { resourceEnv, type BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// docs/research/raw/render-preview-environments.md § "Environment variables"
// INFERRED: a static site passes, because the page names web services and Render emits a static
// site as type: web.
const kindIgnoringPreviewValue = (resource: BlueprintResource): 'worker' | 'cron' | undefined => {
  switch (resource.kind) {
    case 'worker':
      return 'worker';
    case 'cron':
      return 'cron';
    case 'web':
    case 'privateService':
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const previewValueIgnored = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const kind = kindIgnoringPreviewValue(resource);
    if (kind === undefined) continue;

    const label = kind === 'worker' ? 'a worker' : 'a cron job';

    for (const entry of resolveEnv(resourceEnv(resource), undefined)) {
      if (entry.form !== 'literal' || entry.previewValue === undefined) continue;

      warnings.push({
        code: 'PreviewValueIgnored',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" writes a previewValue on the environment variable "${entry.key}". Render supports the override for web services, private services and environment groups, so ${label} never reads it; set the value on the service the preview reads, or move the variable to an environment group.`,
      });
    }
  }

  return warnings;
};
