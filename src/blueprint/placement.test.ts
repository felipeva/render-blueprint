import { describe, expect, it } from 'vitest';

import { web } from '../resources/web.js';
import { blueprint } from './blueprint.js';
import { environment } from './environment.js';
import { placement } from './placement.js';
import { project } from './project.js';

describe('placement', () => {
  it('flattens the root, every project environment, and the ungrouped list into one list', () => {
    const api = web('api', { runtime: 'node' });
    const worker = web('worker', { runtime: 'node' });
    const docs = web('docs', { runtime: 'node' });

    const placed = placement(
      blueprint({
        resources: [api],
        projects: [
          project('acme', {
            environments: [
              environment('production', { resources: [worker] }),
              environment('staging', { resources: [] }),
            ],
          }),
        ],
        ungrouped: [docs],
      }),
    );

    expect(placed.map((entry) => entry.resource)).toEqual([api, worker, docs]);
  });

  it('names the location each resource was placed in', () => {
    const api = web('api', { runtime: 'node' });
    const worker = web('worker', { runtime: 'node' });
    const docs = web('docs', { runtime: 'node' });

    const placed = placement(
      blueprint({
        resources: [api],
        projects: [
          project('acme', { environments: [environment('production', { resources: [worker] })] }),
        ],
        ungrouped: [docs],
      }),
    );

    expect(placed.map((entry) => entry.location)).toEqual([
      'the root resource list',
      'project "acme" environment "production"',
      'the ungrouped list',
    ]);
  });

  it('places nothing for a blueprint with no resources', () => {
    expect(placement(blueprint({}))).toEqual([]);
  });
});
