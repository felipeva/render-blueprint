import { resolveEnv } from '../../env/resolve-env.js';
import { resourceEnv, type BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

// spec §6.1 and §11: previewValue overrides a value for a web or a private service in a preview
// environment, and spec §10 records the override as supported in an environment group. INFERRED: a
// static site passes, because Render emits it as type: web and the prose excludes it nowhere.
const kindIgnoringPreviewValue = (resource: BlueprintResource): string | undefined => {
  switch (resource.kind) {
    case 'worker':
      return 'a worker';
    case 'cron':
      return 'a cron job';
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

    for (const entry of resolveEnv(resourceEnv(resource), undefined)) {
      if (entry.form !== 'literal' || entry.previewValue === undefined) continue;

      warnings.push({
        code: 'PreviewValueIgnored',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" writes a previewValue on the environment variable "${entry.key}". Render overrides a value with previewValue for a web or a private service in a preview environment, so ${kind} never reads it.`,
      });
    }
  }

  return warnings;
};
