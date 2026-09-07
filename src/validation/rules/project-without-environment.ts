import type { Project } from '../../blueprint/project.js';
import type { ValidationIssue } from '../issue.js';

// spec §2: each project must have at least one environment.
export const projectWithoutEnvironment = (
  projects: readonly Project[],
): readonly ValidationIssue[] =>
  projects.flatMap((entry): readonly ValidationIssue[] =>
    entry.environments.length === 0
      ? [
          {
            code: 'ProjectWithoutEnvironment',
            at: { resource: entry.name, field: 'environments' },
            message: 'A project holds a list of its environments; Render requires at least one.',
          },
        ]
      : [],
  );
