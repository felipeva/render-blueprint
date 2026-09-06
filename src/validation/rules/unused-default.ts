import { DEFAULT_KEYS, type DefaultsDeclaration } from '../../resources/defaults-provenance.js';
import { resourceDefaults, type BlueprintResource } from '../../resources/resource.js';
import type { ValidationWarning } from '../issue.js';

interface ScopeUse {
  readonly first: string;
  readonly names: string[];
  readonly used: Set<string>;
}

const MODELED_KEYS: ReadonlySet<string> = new Set(DEFAULT_KEYS);

const listed = (names: readonly string[]): string =>
  names.map((name) => `"${name}"`).join(names.length === 2 ? ' and ' : ', ');

const message = (key: string, names: readonly string[]): string =>
  MODELED_KEYS.has(key)
    ? `The defaults scope that created ${listed(names)} sets "${key}", and nothing it created takes it. A resource that sets the field wins over the scope, and a kind the field does not reach never receives it.`
    : `The defaults scope that created ${listed(names)} sets "${key}", which is not a default this library models, so nothing reads it.`;

// A scope reaches validation through the resources it filled, so a scope whose resources are never
// listed says nothing here, and a key every resource overrode counts as unused just as a key no
// kind accepts does.
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
          first: resource.name,
          names: [resource.name],
          used: new Set(),
        });
        continue;
      }

      use.names.push(resource.name);
    }

    for (const entry of provenance.applied) scopes.get(entry.scope)?.used.add(entry.key);
  }

  const warnings: ValidationWarning[] = [];

  for (const [declaration, use] of scopes) {
    for (const key of declaration.keys) {
      if (use.used.has(key)) continue;

      warnings.push({
        code: 'UnusedDefault',
        at: { resource: use.first, field: `defaults.${key}` },
        message: message(key, use.names),
      });
    }
  }

  return warnings;
};
