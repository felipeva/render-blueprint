import { describe, expect, it } from 'vitest';

import { blueprint, type BlueprintConfig } from '../blueprint/blueprint.js';
import { environment, type EnvironmentConfig } from '../blueprint/environment.js';
import { project, type ProjectConfig } from '../blueprint/project.js';
import { web } from '../resources/web.js';
import { parsePlacement } from './parse-placement.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const uncheckedBlueprint: (json: string) => BlueprintConfig = JSON.parse;
const uncheckedProject: (json: string) => ProjectConfig = JSON.parse;
const uncheckedEnvironment: (json: string) => EnvironmentConfig = JSON.parse;

describe('parsePlacement', () => {
  it('reports a root field the library does not model', () => {
    const issues = parsePlacement(blueprint(uncheckedBlueprint('{"previewz":{}}')));

    expect(issues).toEqual([
      {
        code: 'UnknownField',
        at: { resource: 'blueprint', field: 'previewz' },
        message: expect.stringContaining('previewz'),
      },
    ]);
  });

  it('reports a preview generation Render does not publish', () => {
    const issues = parsePlacement(
      blueprint(uncheckedBlueprint('{"previews":{"generation":"always"}}')),
    );

    expect(issues.map((issue) => [issue.code, issue.at.field])).toEqual([
      ['InvalidConfig', 'previews.generation'],
    ]);
  });

  it('reports a preview expiry Render would reject', () => {
    const issues = parsePlacement(
      blueprint(uncheckedBlueprint('{"previews":{"expireAfterDays":0}}')),
    );

    expect(issues.map((issue) => [issue.code, issue.at.field])).toEqual([
      ['InvalidConfig', 'previews.expireAfterDays'],
    ]);
  });

  it('reports a preview field the library does not model', () => {
    const issues = parsePlacement(blueprint(uncheckedBlueprint('{"previews":{"enabled":true}}')));

    expect(issues.map((issue) => [issue.code, issue.at.field])).toEqual([
      ['UnknownField', 'previews.enabled'],
    ]);
  });

  it('reports a project field the library does not model', () => {
    const issues = parsePlacement(
      blueprint({
        projects: [project('acme', uncheckedProject('{"environments":[],"region":"oregon"}'))],
      }),
    );

    expect(issues).toEqual([
      {
        code: 'UnknownField',
        at: { resource: 'acme', field: 'region' },
        message: expect.stringContaining('region'),
      },
    ]);
  });

  it('reports an environment field the library does not model', () => {
    const issues = parsePlacement(
      blueprint({
        projects: [
          project('acme', {
            environments: [environment('production', uncheckedEnvironment('{"networking":{}}'))],
          }),
        ],
      }),
    );

    expect(issues).toEqual([
      {
        code: 'UnknownField',
        at: { resource: 'production', field: 'networking' },
        message: expect.stringContaining('networking'),
      },
    ]);
  });

  it('defers the environments of a project that did not parse', () => {
    const issues = parsePlacement(
      blueprint({
        projects: [
          project(
            '',
            uncheckedProject('{"environments":[{"name":"","resources":[],"networking":{}}]}'),
          ),
        ],
      }),
    );

    expect(issues.map((issue) => issue.at.field)).toEqual(['name']);
  });

  it('reports nothing for a blueprint the factories built', () => {
    const issues = parsePlacement(
      blueprint({
        previews: { generation: 'automatic', expireAfterDays: 7 },
        projects: [
          project('acme', {
            environments: [
              environment('production', { resources: [web('api', { runtime: 'node' })] }),
            ],
          }),
        ],
        ungrouped: [web('docs', { runtime: 'node' })],
        extraFields: { version: '1' },
      }),
    );

    expect(issues).toEqual([]);
  });
});
