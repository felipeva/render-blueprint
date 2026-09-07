import { describe, expect, it } from 'vitest';

import type { PlanDefaults, ResourceDefaults } from '../../defaults/resource-defaults.js';
import { withDefaults } from '../../defaults/with-defaults.js';
import { web } from '../../resources/web.js';
import { unusedDefault } from './unused-default.js';

// SAFETY: JSON.parse returns any. The records below stand in for a defaults scope the CLI loaded
// through Node type stripping, which erases types without checking them.
const unchecked: (json: string) => ResourceDefaults = JSON.parse;
const uncheckedPlan: (json: string) => PlanDefaults = JSON.parse;

describe('unusedDefault', () => {
  it('warns about a default no resource it created has', () => {
    const scope = withDefaults({ region: 'frankfurt', repo: 'https://github.com/acme/mono' });

    expect(unusedDefault([scope.staticSite('site', { buildCommand: 'pnpm build' })])).toEqual([
      {
        code: 'UnusedDefault',
        at: { resource: 'site', field: 'defaults.region' },
        message: expect.stringContaining('no resource it created has that field'),
      },
    ]);
  });

  it('warns about a plan key for a kind the scope never created', () => {
    const scope = withDefaults({ plan: { web: 'standard', cron: 'starter' } });

    expect(
      unusedDefault([scope.web('api', { runtime: 'node' })]).map((warning) => warning.at),
    ).toEqual([{ resource: 'api', field: 'defaults.plan.cron' }]);
  });

  it('warns about a repository default when every resource pulls a prebuilt image', () => {
    const scope = withDefaults({ repo: 'https://github.com/acme/mono', region: 'frankfurt' });

    expect(
      unusedDefault([
        scope.worker('jobs', { runtime: 'image', image: { url: 'acme/jobs:1.4.0' } }),
      ]).map((warning) => warning.at),
    ).toEqual([{ resource: 'jobs', field: 'defaults.repo' }]);
  });

  it('leaves a default a resource overrode alone', () => {
    const scope = withDefaults({ region: 'frankfurt' });

    expect(
      unusedDefault([
        scope.web('api', { runtime: 'node', region: 'ohio' }),
        scope.worker('jobs', { runtime: 'node', region: 'oregon' }),
      ]),
    ).toEqual([]);
  });

  it('leaves a base value an inner scope overrode alone', () => {
    const team = withDefaults({ region: 'frankfurt', branch: 'main' });
    const preview = team.withDefaults({ branch: 'preview' });

    expect(unusedDefault([preview.web('api', { runtime: 'node' })])).toEqual([]);
  });

  it('leaves a default alone when one resource of the scope has the field', () => {
    const scope = withDefaults({ region: 'frankfurt' });

    expect(
      unusedDefault([
        scope.staticSite('site', { buildCommand: 'pnpm build' }),
        scope.web('api', { runtime: 'node' }),
      ]),
    ).toEqual([]);
  });

  it('warns about an inner default no resource of the inner scope has', () => {
    const team = withDefaults({ region: 'frankfurt' });
    const sites = team.withDefaults({ region: 'ohio', repo: 'https://github.com/acme/mono' });

    expect(
      unusedDefault([
        team.web('api', { runtime: 'node' }),
        sites.staticSite('site', { buildCommand: 'pnpm build' }),
      ]).map((warning) => warning.at),
    ).toEqual([{ resource: 'site', field: 'defaults.region' }]);
  });

  it('warns about a build filter no resource under the scope can take', () => {
    const scope = withDefaults({ buildFilter: { paths: ['apps/**'] }, region: 'frankfurt' });

    expect(
      unusedDefault([scope.postgres('records'), scope.keyValue('cache', { ipAllowList: [] })]).map(
        (warning) => warning.at,
      ),
    ).toEqual([{ resource: 'records', field: 'defaults.buildFilter' }]);
  });

  it('warns about a build filter when every service pulls a prebuilt image', () => {
    const scope = withDefaults({ autoDeployTrigger: 'checksPass' });

    expect(
      unusedDefault([
        scope.worker('jobs', { runtime: 'image', image: { url: 'acme/jobs:1.4.0' } }),
      ]).map((warning) => warning.at),
    ).toEqual([{ resource: 'jobs', field: 'defaults.autoDeployTrigger' }]);
  });

  it('warns about an allow list the kinds the scope created never carry', () => {
    const scope = withDefaults({ ipAllowList: [{ source: '203.0.113.0/24' }] });

    expect(
      unusedDefault([
        scope.worker('jobs', { runtime: 'node' }),
        scope.keyValue('cache', { ipAllowList: [] }),
      ]).map((warning) => warning.at),
    ).toEqual([{ resource: 'jobs', field: 'defaults.ipAllowList' }]);
  });

  it('leaves a build filter one resource of the scope overrode alone', () => {
    const scope = withDefaults({ buildFilter: { paths: ['apps/**'] } });

    expect(
      unusedDefault([scope.web('api', { runtime: 'node', buildFilter: { paths: ['api/**'] } })]),
    ).toEqual([]);
  });

  it('leaves an outer allow list an inner scope overrode alone', () => {
    const team = withDefaults({ ipAllowList: [{ source: '203.0.113.0/24' }] });
    const app = team.withDefaults({ ipAllowList: [] });

    expect(unusedDefault([app.staticSite('site', { buildCommand: 'pnpm build' })])).toEqual([]);
  });

  it('warns about nothing for a resource no scope created', () => {
    expect(unusedDefault([web('api', { runtime: 'node' })])).toEqual([]);
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

  it('warns about a plan written as a string', () => {
    const scope = withDefaults({ plan: uncheckedPlan('"starter"') });

    expect(unusedDefault([scope.web('api', { runtime: 'node' })])).toEqual([
      {
        code: 'UnusedDefault',
        at: { resource: 'api', field: 'defaults.plan' },
        message: expect.stringContaining('a plan default is a record with one key per kind'),
      },
    ]);
  });

  it('warns about a plan written as a number', () => {
    const scope = withDefaults({ plan: uncheckedPlan('5') });

    expect(
      unusedDefault([scope.web('api', { runtime: 'node' })]).map((warning) => warning.at),
    ).toEqual([{ resource: 'api', field: 'defaults.plan' }]);
  });

  it('names every resource the scope created, with one conjunction', () => {
    const scope = withDefaults({ region: 'frankfurt' });

    expect(
      unusedDefault([
        scope.staticSite('docs', { buildCommand: 'pnpm build' }),
        scope.staticSite('site', { buildCommand: 'pnpm build' }),
        scope.staticSite('www', { buildCommand: 'pnpm build' }),
      ])[0]?.message,
    ).toContain('created "docs", "site" and "www"');
  });

  it('anchors a warning at the first resource the blueprint lists', () => {
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
