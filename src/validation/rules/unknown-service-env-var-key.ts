import { RENDER_PROVIDED_KEYS } from '../../enums/render-provided-key.js';
import { resolveEnv } from '../../env/resolve-env.js';
import {
  resourceEnv,
  serviceReferenceType,
  type BlueprintResource,
} from '../../resources/resource.js';
import type { ValidationIssue } from '../issue.js';

// spec §6.6: Render sets these on every service, so a reference to one always resolves.
const RENDER_PROVIDED: ReadonlySet<string> = new Set(RENDER_PROVIDED_KEYS);

const declaredKeys = (
  resources: readonly BlueprintResource[],
): ReadonlyMap<string, ReadonlySet<string>> => {
  const declared = new Map<string, ReadonlySet<string>>();

  for (const resource of resources) {
    if (serviceReferenceType(resource) === undefined) continue;

    const env = resourceEnv(resource);
    declared.set(resource.name, new Set<string>(env === undefined ? [] : Object.keys(env)));
  }

  return declared;
};

// A target this blueprint does not list carries no key list, so danglingReference owns it.
export const unknownServiceEnvVarKey = (
  resources: readonly BlueprintResource[],
): readonly ValidationIssue[] => {
  const declared = declaredKeys(resources);
  const issues: ValidationIssue[] = [];

  for (const resource of resources) {
    const env = resourceEnv(resource);
    if (env === undefined) continue;

    for (const entry of resolveEnv(env, undefined)) {
      if (entry.form !== 'fromService' || !('envVarKey' in entry.reference)) continue;

      const target = declared.get(entry.reference.name);
      const key = entry.reference.envVarKey;
      if (target === undefined || RENDER_PROVIDED.has(key) || target.has(key)) continue;

      issues.push({
        code: 'UnknownServiceEnvVarKey',
        at: { resource: resource.name, field: `env.${entry.key}` },
        message: `"${resource.name}" reads "${entry.key}" from the environment variable "${key}" on "${entry.reference.name}", which declares no such key. Declare it there, or name one of the variables Render provides.`,
      });
    }
  }

  return issues;
};
