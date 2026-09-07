import { describe, expect, it } from 'vitest';

import { environment } from './environment.js';
import { parseProject, project } from './project.js';

interface RaisedIssue {
  readonly validationCode: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

const raisedIssues = (value: ReturnType<typeof project>): readonly RaisedIssue[] => {
  const result = parseProject(value);
  if (result.success) return [];

  return result.error.issues.flatMap((issue): readonly RaisedIssue[] =>
    issue.code === 'custom'
      ? [
          {
            validationCode: String(issue.params?.['validationCode']),
            path: issue.path,
            message: issue.message,
          },
        ]
      : [],
  );
};

describe('parseProject', () => {
  it('raises ProjectWithoutEnvironment on a project that declares no environment', () => {
    expect(
      raisedIssues(project('acme', { environments: [] })).map((issue) => [
        issue.validationCode,
        issue.path,
      ]),
    ).toEqual([['ProjectWithoutEnvironment', ['environments']]]);
  });

  it('says Render requires at least one environment', () => {
    const [issue] = raisedIssues(project('acme', { environments: [] }));

    expect(issue?.message).toContain('Render requires at least one');
  });

  it('accepts a project that declares one environment', () => {
    const result = parseProject(
      project('acme', { environments: [environment('production', { resources: [] })] }),
    );

    expect(result.success).toBe(true);
  });
});
