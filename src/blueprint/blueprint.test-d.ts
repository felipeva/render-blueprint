import { describe, it } from 'vitest';

import { web } from '../resources/web.js';
import { blueprint } from './blueprint.js';
import { environment } from './environment.js';
import { project } from './project.js';

describe('blueprint', () => {
  it('rejects a resource list entry that is not a resource', () => {
    // @ts-expect-error a bare string is not a BlueprintResource.
    blueprint({ resources: ['api'] });
  });

  it('rejects an environment in the resource list', () => {
    // @ts-expect-error an environment is a placement, not a resource.
    blueprint({ resources: [environment('production', { resources: [] })] });
  });

  it('rejects a project in the resource list', () => {
    // @ts-expect-error a project is a placement, not a resource.
    blueprint({ resources: [project('acme', { environments: [] })] });
  });

  it('rejects an environment in the ungrouped list', () => {
    // @ts-expect-error the ungrouped list holds resources, not placements.
    blueprint({ ungrouped: [environment('production', { resources: [] })] });
  });

  it('rejects a resource in the project list', () => {
    // @ts-expect-error the project list holds projects, not resources.
    blueprint({ projects: [web('api', { runtime: 'node' })] });
  });

  it('rejects a preview generation Render does not publish', () => {
    // @ts-expect-error "always" is not a member of PreviewGeneration.
    blueprint({ previews: { generation: 'always' } });
  });

  it('rejects a root field the library does not model', () => {
    // @ts-expect-error previewz is not a blueprint field; extraFields is the escape hatch.
    blueprint({ previewz: { generation: 'automatic' } });
  });
});

describe('project', () => {
  it('rejects a resource in the environment list', () => {
    // @ts-expect-error a web service is not an environment.
    project('acme', { environments: [web('api', { runtime: 'node' })] });
  });

  it('requires the environment list', () => {
    // @ts-expect-error Render requires a project to declare its environments.
    project('acme', {});
  });
});

describe('environment', () => {
  it('rejects a project in the resource list', () => {
    // @ts-expect-error a project is not a resource an environment can hold.
    environment('production', { resources: [project('acme', { environments: [] })] });
  });
});
