import { describe, expect, it } from 'vitest';

import { blueprint } from '../../blueprint/blueprint.js';
import { environment } from '../../blueprint/environment.js';
import { placement } from '../../blueprint/placement.js';
import { project } from '../../blueprint/project.js';
import { web } from '../../resources/web.js';
import { resourceInMultipleLocations } from './resource-in-multiple-locations.js';

describe('resourceInMultipleLocations', () => {
  it('reports a resource value placed at the root and in a project environment', () => {
    const api = web('api', { runtime: 'node' });

    const issues = resourceInMultipleLocations(
      placement(
        blueprint({
          resources: [api],
          projects: [
            project('acme', { environments: [environment('production', { resources: [api] })] }),
          ],
        }),
      ),
    );

    expect(issues).toEqual([
      {
        code: 'ResourceInMultipleLocations',
        at: { resource: 'api', field: 'placement' },
        message: expect.stringContaining('project "acme" environment "production"'),
      },
    ]);
  });

  it('reports a resource value placed in two environments of one project', () => {
    const api = web('api', { runtime: 'node' });

    const issues = resourceInMultipleLocations(
      placement(
        blueprint({
          projects: [
            project('acme', {
              environments: [
                environment('production', { resources: [api] }),
                environment('staging', { resources: [api] }),
              ],
            }),
          ],
        }),
      ),
    );

    expect(issues.map((issue) => issue.code)).toEqual(['ResourceInMultipleLocations']);
  });

  it('reports nothing for two resource values that share a name', () => {
    const issues = resourceInMultipleLocations(
      placement(
        blueprint({
          resources: [web('api', { runtime: 'node' })],
          ungrouped: [web('api', { runtime: 'node' })],
        }),
      ),
    );

    expect(issues).toEqual([]);
  });

  it('reports nothing for a resource placed once', () => {
    expect(
      resourceInMultipleLocations(
        placement(blueprint({ resources: [web('api', { runtime: 'node' })] })),
      ),
    ).toEqual([]);
  });
});
