import type { BlueprintResource } from '../../resources/resource.js';
import { nativeSource } from '../../resources/service-source.js';
import type { ValidationWarning } from '../issue.js';

interface StartedFromSource {
  readonly runtime: string;
  readonly startCommand: string | undefined;
}

// spec §4.1: a static site is served rather than started, and a Docker source starts with the
// dockerCommand or the image's own CMD, so only a native runtime has a start command to miss.
const startedFromSource = (resource: BlueprintResource): StartedFromSource | undefined => {
  switch (resource.kind) {
    case 'web':
    case 'privateService':
    case 'worker':
    case 'cron': {
      const native = nativeSource(resource.config);
      return native === undefined
        ? undefined
        : { runtime: native.runtime, startCommand: resource.config.startCommand };
    }
    case 'staticSite':
    case 'keyValue':
    case 'postgres':
    case 'envGroup':
      return undefined;
  }
};

export const missingStartCommand = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] =>
  resources.flatMap((resource): readonly ValidationWarning[] => {
    const started = startedFromSource(resource);

    return started === undefined || started.startCommand !== undefined
      ? []
      : [
          {
            code: 'MissingStartCommand',
            at: { resource: resource.name, field: 'startCommand' },
            message: `"${resource.name}" runs on the "${started.runtime}" runtime with no startCommand. Render's documentation calls it required for every service it builds from source.`,
          },
        ];
  });
