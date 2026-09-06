import type {
  DriftReport,
  ImmutableFieldChange,
  ValidationIssue,
  ValidationWarning,
} from '../index.js';

const indent = (line: string): string => `  ${line}`;

export interface FailureWithCause {
  readonly message: string;
  readonly cause: unknown;
}

export const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const formatFailure = (failure: FailureWithCause): string =>
  `${failure.message}\n${indent(formatCause(failure.cause))}`;

export const formatIssues = (issues: readonly ValidationIssue[]): string =>
  [
    `The blueprint has ${String(issues.length)} validation ${
      issues.length === 1 ? 'issue' : 'issues'
    }; nothing was synthesized.`,
    ...issues.map((issue) => indent(`${issue.at.resource}.${issue.at.field}: ${issue.message}`)),
  ].join('\n');

export const formatWarnings = (warnings: readonly ValidationWarning[]): string =>
  warnings
    .map((warning) => `warning ${warning.at.resource}.${warning.at.field}: ${warning.message}`)
    .join('\n');

type DriftDetected = Extract<DriftReport, { readonly status: 'drift' }>;

const parseErrorLines = (path: string, errors: readonly string[]): readonly string[] =>
  errors.length === 0
    ? []
    : [`${path} is not valid YAML, so it is compared as plain text:`, ...errors.map(indent), ''];

const immutableLines = (changes: readonly ImmutableFieldChange[]): readonly string[] =>
  changes.length === 0
    ? []
    : [
        '',
        'Render cannot change these fields in place:',
        ...changes.map(
          (change) =>
            `  ${change.section} "${change.resource}" ${change.field}: ${change.committed} -> ${change.generated}`,
        ),
      ];

export const formatDrift = (path: string, report: DriftDetected): string =>
  [
    `${path} has drifted from the blueprint.`,
    ...parseErrorLines(path, report.parseErrors),
    'The diff compares normalized YAML; its line numbers are positions in that text, not offsets into either file.',
    `--- committed ${path} (normalized)`,
    '+++ generated from the blueprint (normalized)',
    report.diff,
    ...immutableLines(report.immutableFieldChanges),
  ].join('\n');
