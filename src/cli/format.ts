import type { ValidationIssue, ValidationWarning } from '../index.js';

export const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const formatIssues = (issues: readonly ValidationIssue[]): string =>
  [
    `The blueprint has ${String(issues.length)} validation ${
      issues.length === 1 ? 'issue' : 'issues'
    }; nothing was synthesized.`,
    ...issues.map((issue) => `  ${issue.at.resource}.${issue.at.field}: ${issue.message}`),
  ].join('\n');

export const formatWarnings = (warnings: readonly ValidationWarning[]): string =>
  warnings
    .map((warning) => `warning ${warning.at.resource}.${warning.at.field}: ${warning.message}`)
    .join('\n');
