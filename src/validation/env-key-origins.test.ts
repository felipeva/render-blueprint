import { describe, expect, it } from 'vitest';

import { envGroup } from '../resources/env-group.js';
import { web } from '../resources/web.js';
import { envKeyOrigins } from './env-key-origins.js';

const settings = envGroup('shared-settings', { env: { LOG_LEVEL: 'info', REGION_NAME: 'oregon' } });

const regional = envGroup('regional', { env: { REGION_NAME: 'frankfurt' } });

describe('envKeyOrigins', () => {
  it('lists the keys the map declares, in declaration order, with no group', () => {
    expect(
      envKeyOrigins(web('api', { runtime: 'node', env: { SECOND: 'two', FIRST: 1 } })),
    ).toEqual([
      { key: 'SECOND', direct: true, groups: [] },
      { key: 'FIRST', direct: true, groups: [] },
    ]);
  });

  it('lists a key only an imported group carries after the keys the map declares', () => {
    expect(
      envKeyOrigins(
        web('api', { runtime: 'node', env: { NODE_ENV: 'production' }, envGroups: [regional] }),
      ),
    ).toEqual([
      { key: 'NODE_ENV', direct: true, groups: [] },
      { key: 'REGION_NAME', direct: false, groups: ['regional'] },
    ]);
  });

  it('names the group on a key the map declares too', () => {
    expect(
      envKeyOrigins(
        web('api', { runtime: 'node', env: { LOG_LEVEL: 'debug' }, envGroups: [settings] }),
      ),
    ).toContainEqual({ key: 'LOG_LEVEL', direct: true, groups: ['shared-settings'] });
  });

  it('names every group carrying a key', () => {
    expect(
      envKeyOrigins(web('api', { runtime: 'node', envGroups: [settings, regional] })),
    ).toContainEqual({
      key: 'REGION_NAME',
      direct: false,
      groups: ['shared-settings', 'regional'],
    });
  });

  it('names one origin for a group imported twice, which imports one set of values', () => {
    expect(envKeyOrigins(web('api', { runtime: 'node', envGroups: [regional, regional] }))).toEqual(
      [{ key: 'REGION_NAME', direct: false, groups: ['regional'] }],
    );
  });

  it('returns no origins for a resource that declares neither a map nor a group', () => {
    expect(envKeyOrigins(web('api', { runtime: 'node' }))).toEqual([]);
  });
});
