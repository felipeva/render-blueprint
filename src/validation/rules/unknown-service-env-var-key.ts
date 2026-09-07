import { RENDER_PROVIDED_KEYS } from '../../enums/render-provided-key.js';
import { resolveEnv } from '../../env/resolve-env.js';
import {
  resourceEnv,
  serviceReferenceType,
  type BlueprintResource,
} from '../../resources/resource.js';
import { envKeyOrigins } from '../env-key-origins.js';
import type { ValidationWarning } from '../issue.js';

// spec §6.6: Render sets these on every service, so a reference to one always resolves.
const RENDER_PROVIDED: ReadonlySet<string> = new Set(RENDER_PROVIDED_KEYS);

const declaredKeys = (
  resources: readonly BlueprintResource[],
): ReadonlyMap<string, ReadonlySet<string>> => {
  const declared = new Map<string, ReadonlySet<string>>();

  for (const { resource, origins } of envKeyOrigins(resources)) {
    if (serviceReferenceType(resource) === undefined) continue;

    declared.set(resource.name, new Set(origins.map((origin) => origin.key)));
  }

  return declared;
};

// spec §6.4: Render preserves variables a blueprint omits.
export const unknownServiceEnvVarKey = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const declared = declaredKeys(resources);
  const warnings: ValidationWarning[] = [];

  for (const resource of resources) {
    const env = resourceEnv(resource);
    if (env === undefined) continue;

    for (const entry of resolveEnv(env, undefined)) {
      if (entry.form !== 'fromService' || !('envVarKey' in entry.reference)) continue;
      if (entry.reference.origin === 'external') continue;

      const target = declared.get(entry.reference.name);
      const key = entry.reference.envVarKey;
      if (target === undefined || RENDER_PROVIDED.has(key) || target.has(key)) continue;

      warnings.push({
        code: 'UnknownServiceEnvVarKey',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" reads "${entry.key}" from the environment variable "${key}" on "${entry.reference.name}", which declares no such key. Render keeps variables a blueprint omits, so the key may exist on Render already; declare it on "${entry.reference.name}", or reach for the target through an external handle.`,
      });
    }
  }

  return warnings;
};
