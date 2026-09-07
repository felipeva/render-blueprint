import { DEFAULT_KEYS, type DefaultsDeclaration } from '../../resources/defaults-provenance.js';
import { resourceDefaults, type BlueprintResource } from '../../resources/resource.js';
import { describeNames } from '../env-key-origins.js';
import type { ValidationWarning } from '../issue.js';

interface ScopeUse {
  readonly firstListed: string;
  readonly names: string[];
  readonly eligible: Set<string>;
}

const MODELED_KEYS: ReadonlySet<string> = new Set(DEFAULT_KEYS);

// One cause: nothing the scope created can take the field from a scope. That is not the same as
// nothing having the field — a Key Value store requires its own ipAllowList, so it has the field
// and still takes no default for it. A resource that set its own value and an inner scope that
// overrode the key both took a default that applies to something, so neither is reported here.
const message = (key: string, names: readonly string[]): string => {
  const scope = `The defaults scope that created ${describeNames(names)} sets "${key}"`;

  if (key === 'plan') {
    return `${scope}, which is not a plan the library can read: a plan default is a record with one key per kind, like { web: "standard" }.`;
  }

  if (!MODELED_KEYS.has(key)) {
    return `${scope}, which is not a default this library models, so nothing reads it.`;
  }

  return `${scope}, which nothing it created can take: a default reaches only a kind and a source branch that can take the field from a scope.`;
};

// A scope reaches validation through the resources it filled, so a scope whose resources are never
// listed says nothing here. A key is used when one of those resources could take it, landed or
// overridden, and unused when the field reaches none of them at all.
export const unusedDefault = (
  resources: readonly BlueprintResource[],
): readonly ValidationWarning[] => {
  const scopes = new Map<DefaultsDeclaration, ScopeUse>();

  for (const resource of resources) {
    const provenance = resourceDefaults(resource);
    if (provenance === undefined) continue;

    for (const declaration of provenance.scopes) {
      const use = scopes.get(declaration);

      if (use === undefined) {
        scopes.set(declaration, {
          firstListed: resource.name,
          names: [resource.name],
          eligible: new Set(provenance.eligible),
        });
        continue;
      }

      use.names.push(resource.name);
      for (const key of provenance.eligible) use.eligible.add(key);
    }
  }

  const warnings: ValidationWarning[] = [];

  for (const [declaration, use] of scopes) {
    for (const key of declaration.keys) {
      if (use.eligible.has(key)) continue;

      warnings.push({
        code: 'UnusedDefault',
        at: { resource: use.firstListed, field: `defaults.${key}` },
        message: message(key, use.names),
      });
    }
  }

  return warnings;
};
