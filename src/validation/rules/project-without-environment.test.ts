import { describe, expect, it } from 'vitest';

import { environment } from '../../blueprint/environment.js';
import { project } from '../../blueprint/project.js';
import { web } from '../../resources/web.js';
import { projectWithoutEnvironment } from './project-without-environment.js';

describe('projectWithoutEnvironment', () => {
  it('reports a project that declares no environment', () => {
    const issues = projectWithoutEnvironment([project('acme', { environments: [] })]);

    expect(issues).toEqual([
      {
        code: 'ProjectWithoutEnvironment',
        at: { resource: 'acme', field: 'environments' },
        message: expect.stringContaining('Render requires at least one'),
      },
    ]);
  });

  it('reports nothing for a project that declares one environment', () => {
    const issues = projectWithoutEnvironment([
      project('acme', {
        environments: [environment('production', { resources: [web('api', { runtime: 'node' })] })],
      }),
    ]);

    expect(issues).toEqual([]);
  });

  it('reports every empty project, not the first', () => {
    const issues = projectWithoutEnvironment([
      project('acme', { environments: [] }),
      project('globex', {
        environments: [environment('production', { resources: [] })],
      }),
      project('initech', { environments: [] }),
    ]);

    expect(issues.map((issue) => issue.at.resource)).toEqual(['acme', 'initech']);
  });

  it('reports nothing for a blueprint that declares no project', () => {
    expect(projectWithoutEnvironment([])).toEqual([]);
  });
});
