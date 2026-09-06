import { describe, expect, it } from 'vitest';

import { web } from '../resources/web.js';
import { blueprint } from './blueprint.js';
import { environment } from './environment.js';
import { project } from './project.js';

describe('blueprint', () => {
  it('keeps the resource list in declaration order', () => {
    const api = web('api', { runtime: 'node' });
    const admin = web('admin', { runtime: 'node' });

    expect(blueprint({ resources: [api, admin] }).resources).toEqual([api, admin]);
  });

  it('treats an omitted resource list as empty', () => {
    expect(blueprint({}).resources).toEqual([]);
  });

  it('treats an omitted project list and ungrouped list as empty', () => {
    const value = blueprint({});

    expect(value.projects).toEqual([]);
    expect(value.ungrouped).toEqual([]);
  });

  it('carries the root previews the author wrote', () => {
    expect(
      blueprint({ previews: { generation: 'automatic', expireAfterDays: 7 } }).previews,
    ).toEqual({ generation: 'automatic', expireAfterDays: 7 });
  });

  it('keeps the projects and the ungrouped resources in declaration order', () => {
    const api = web('api', { runtime: 'node' });
    const docs = web('docs', { runtime: 'node' });
    const acme = project('acme', {
      environments: [environment('production', { resources: [api] })],
    });

    const value = blueprint({ projects: [acme], ungrouped: [docs] });

    expect(value.projects).toEqual([acme]);
    expect(value.ungrouped).toEqual([docs]);
  });
});

describe('project', () => {
  it('carries the name and the environments the author wrote', () => {
    const production = environment('production', { resources: [] });

    expect(project('acme', { environments: [production] })).toEqual({
      name: 'acme',
      environments: [production],
    });
  });
});

describe('environment', () => {
  it('carries the name and the resources the author wrote', () => {
    const api = web('api', { runtime: 'node' });

    expect(environment('production', { resources: [api] })).toEqual({
      name: 'production',
      resources: [api],
    });
  });

  it('treats an omitted resource list as empty', () => {
    expect(environment('production', {}).resources).toEqual([]);
  });
});
