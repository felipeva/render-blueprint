import { describe, expect, it } from 'vitest';

import type { ValidationIssue, ValidationWarning } from '../index.js';
import { formatCause, formatIssues, formatWarnings } from './format.js';

const issue: ValidationIssue = {
  code: 'DuplicateResourceName',
  at: { resource: 'api', field: 'name' },
  message: 'Two resources are named "api".',
};

const warning: ValidationWarning = {
  code: 'MissingBuildCommand',
  at: { resource: 'api', field: 'buildCommand' },
  message: 'No buildCommand.',
};

describe('formatIssues', () => {
  it('puts every issue on its own line under a headline', () => {
    expect(formatIssues([issue, { ...issue, at: { resource: 'db', field: 'plan' } }])).toBe(
      [
        'The blueprint has 2 validation issues; nothing was synthesized.',
        '  api.name: Two resources are named "api".',
        '  db.plan: Two resources are named "api".',
      ].join('\n'),
    );
  });

  it('counts a single issue in the singular', () => {
    expect(formatIssues([issue])).toContain('1 validation issue;');
  });
});

describe('formatWarnings', () => {
  it('prefixes every warning with the word warning', () => {
    expect(formatWarnings([warning])).toBe('warning api.buildCommand: No buildCommand.');
  });

  it('renders no warnings as the empty string', () => {
    expect(formatWarnings([])).toBe('');
  });
});

describe('formatCause', () => {
  it('renders an Error as its message', () => {
    expect(formatCause(new Error('ENOENT: no such file'))).toBe('ENOENT: no such file');
  });

  it('renders anything else through String', () => {
    expect(formatCause('plain')).toBe('plain');
  });
});
