import { describe, expect, it } from 'vitest';

import { envGroup } from '../resources/env-group.js';
import { web } from '../resources/web.js';
import { describeGroups, envKeyOrigins } from './env-key-origins.js';

const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info', REGION_NAME: 'oregon' } });

const regional = envGroup('regional', { env: { REGION_NAME: 'frankfurt' } });

const originsOf = (resources: Parameters<typeof envKeyOrigins>[0], name: string) =>
  envKeyOrigins(resources).find((entry) => entry.resource.name === name)?.origins;

describe('envKeyOrigins', () => {
  it('lists the keys the map declares, in declaration order, with no group', () => {
    expect(
      originsOf([web('api', { runtime: 'node', env: { SECOND: 'two', FIRST: 1 } })], 'api'),
    ).toEqual([
      { key: 'SECOND', direct: true, groups: [] },
      { key: 'FIRST', direct: true, groups: [] },
    ]);
  });

  it('lists a key only an imported group carries after the keys the map declares', () => {
    const api = web('api', {
      runtime: 'node',
      env: { NODE_ENV: 'production' },
      envGroups: [regional],
    });

    expect(originsOf([api, regional], 'api')).toEqual([
      { key: 'NODE_ENV', direct: true, groups: [] },
      { key: 'REGION_NAME', direct: false, groups: ['regional'] },
    ]);
  });

  it('names the group on a key the map declares too', () => {
    const api = web('api', {
      runtime: 'node',
      env: { LOG_LEVEL: 'debug' },
      envGroups: [settings],
    });

    expect(originsOf([api, settings], 'api')).toContainEqual({
      key: 'LOG_LEVEL',
      direct: true,
      groups: ['shared-settings'],
    });
  });

  it('names every group carrying a key', () => {
    const api = web('api', { runtime: 'node', envGroups: [settings, regional] });

    expect(originsOf([api, settings, regional], 'api')).toContainEqual({
      key: 'REGION_NAME',
      direct: false,
      groups: ['shared-settings', 'regional'],
    });
  });

  it('names one origin for a group imported twice, which imports one set of values', () => {
    const api = web('api', { runtime: 'node', envGroups: [regional, regional] });

    expect(originsOf([api, regional], 'api')).toEqual([
      { key: 'REGION_NAME', direct: false, groups: ['regional'] },
    ]);
  });

  it('reads the keys of the listed group of that name, not those of the object held', () => {
    const stale = envGroup('shared-settings', { env: { OTHER: 'x' } });
    const api = web('api', { runtime: 'node', env: { LOG_LEVEL: 'debug' }, envGroups: [stale] });

    expect(originsOf([api, settings], 'api')).toEqual([
      { key: 'LOG_LEVEL', direct: true, groups: ['shared-settings'] },
      { key: 'REGION_NAME', direct: false, groups: ['shared-settings'] },
    ]);
  });

  it('reads the keys of the object held when no listed group answers to that name', () => {
    const dashboard = envGroup('dashboard-managed', {
      env: { STRIPE_KEY: 'set in the dashboard' },
    });
    const api = web('api', { runtime: 'node', envGroups: [dashboard] });

    expect(originsOf([api], 'api')).toEqual([
      { key: 'STRIPE_KEY', direct: false, groups: ['dashboard-managed'] },
    ]);
  });

  it('returns no origins for a resource that declares neither a map nor a group', () => {
    expect(originsOf([web('api', { runtime: 'node' })], 'api')).toEqual([]);
  });
});

describe('describeGroups', () => {
  it('names one group in the singular', () => {
    expect(describeGroups(['a'])).toBe('group "a"');
  });

  it('joins two names with and', () => {
    expect(describeGroups(['a', 'b'])).toBe('groups "a" and "b"');
  });

  it('separates three names with commas and joins the last with and', () => {
    expect(describeGroups(['a', 'b', 'c'])).toBe('groups "a", "b" and "c"');
  });
});
