import { describe, expect, it } from 'vitest';

import type { ResourceDefaults } from '../../defaults/resource-defaults.js';
import { withDefaults } from '../../defaults/with-defaults.js';
import { web } from '../../resources/web.js';
import { unusedDefault } from './unused-default.js';

// SAFETY: JSON.parse returns any. The record below stands in for a defaults scope the CLI loaded
// through Node type stripping, which erases types without checking them.
const unchecked: (json: string) => ResourceDefaults = JSON.parse;

describe('unusedDefault', () => {
  it('warns about a default no resource the scope created takes', () => {
    const scope = withDefaults({ region: 'frankfurt', repo: 'https://github.com/acme/mono' });

    expect(unusedDefault([scope.staticSite('site', { buildCommand: 'pnpm build' })])).toEqual([
      {
        code: 'UnusedDefault',
        at: { resource: 'site', field: 'defaults.region' },
        message: expect.stringContaining('and nothing it created takes it'),
      },
    ]);
  });

  it('warns about a default every resource overrode', () => {
    const scope = withDefaults({ region: 'frankfurt' });

    expect(
      unusedDefault([
        scope.web('api', { runtime: 'node', region: 'ohio' }),
        scope.worker('jobs', { runtime: 'node', region: 'oregon' }),
      ]).map((warning) => warning.at),
    ).toEqual([{ resource: 'api', field: 'defaults.region' }]);
  });

  it('names every resource the scope created', () => {
    const scope = withDefaults({ branch: 'main' });

    expect(
      unusedDefault([scope.postgres('records'), scope.keyValue('cache', { ipAllowList: [] })])[0]
        ?.message,
    ).toContain('"records" and "cache"');
  });

  it('warns about nothing when every default landed somewhere', () => {
    const scope = withDefaults({ region: 'frankfurt', plan: { web: 'standard' } });

    expect(unusedDefault([scope.web('api', { runtime: 'node' })])).toEqual([]);
  });

  it('warns about nothing for a resource no scope created', () => {
    expect(unusedDefault([web('api', { runtime: 'node' })])).toEqual([]);
  });

  it('credits the inner scope and warns about the key it shadowed', () => {
    const team = withDefaults({ region: 'frankfurt' });
    const app = team.withDefaults({ region: 'singapore' });

    expect(
      unusedDefault([app.web('api', { runtime: 'node' })]).map((warning) => warning.at),
    ).toEqual([{ resource: 'api', field: 'defaults.region' }]);
  });

  it('leaves an outer default the inner scope did not shadow alone', () => {
    const team = withDefaults({ region: 'frankfurt' });
    const app = team.withDefaults({ repo: 'https://github.com/acme/mono' });

    expect(unusedDefault([app.web('api', { runtime: 'node' })])).toEqual([]);
  });

  it('warns about a key the library does not model', () => {
    const scope = withDefaults(unchecked('{ "regoin": "frankfurt" }'));

    expect(unusedDefault([scope.web('api', { runtime: 'node' })])).toEqual([
      {
        code: 'UnusedDefault',
        at: { resource: 'api', field: 'defaults.regoin' },
        message: expect.stringContaining('not a default this library models'),
      },
    ]);
  });

  it('warns once per unused key, at the first resource the scope created', () => {
    const scope = withDefaults({ repo: 'https://github.com/acme/mono', branch: 'main' });

    expect(
      unusedDefault([scope.postgres('records'), scope.keyValue('cache', { ipAllowList: [] })]).map(
        (warning) => warning.at,
      ),
    ).toEqual([
      { resource: 'records', field: 'defaults.repo' },
      { resource: 'records', field: 'defaults.branch' },
    ]);
  });
});
