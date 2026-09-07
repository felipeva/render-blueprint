import { describe, expect, it } from 'vitest';

import { environment } from './environment.js';
import { parseProject, project, type ProjectConfig } from './project.js';

// SAFETY: JSON.parse returns any. The config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const uncheckedProject: (json: string) => ProjectConfig = JSON.parse;

const messages = (value: ReturnType<typeof project>): readonly string[] => {
  const result = parseProject(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('parseProject', () => {
  it('says an environments that is not a list is not one', () => {
    expect(messages(project('acme', uncheckedProject('{"environments":"nope"}')))).toEqual([
      expect.stringContaining('list of the values environment() returned'),
    ]);
  });

  it('accepts a project that declares one environment', () => {
    expect(
      messages(project('acme', { environments: [environment('production', { resources: [] })] })),
    ).toEqual([]);
  });

  it('leaves an empty environments list to the rule tier', () => {
    expect(messages(project('acme', { environments: [] }))).toEqual([]);
  });
});
