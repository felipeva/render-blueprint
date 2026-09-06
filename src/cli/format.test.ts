import { describe, expect, it } from 'vitest';

import type { DriftReport, ValidationIssue, ValidationWarning } from '../index.js';
import { formatCause, formatDrift, formatFailure, formatIssues, formatWarnings } from './format.js';

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

describe('formatFailure', () => {
  it('puts the cause on an indented line under the message', () => {
    expect(
      formatFailure({ message: 'Could not read render.yaml.', cause: new Error('ENOENT') }),
    ).toBe('Could not read render.yaml.\n  ENOENT');
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

const drift = (
  extra: Partial<Extract<DriftReport, { readonly status: 'drift' }>>,
): Extract<DriftReport, { readonly status: 'drift' }> => ({
  status: 'drift',
  diff: '@@ -4,1 +4,1 @@\n-    plan: starter\n+    plan: standard',
  immutableFieldChanges: [],
  parseErrors: [],
  warnings: [],
  ...extra,
});

describe('formatDrift', () => {
  it('heads the diff with both sides named as normalized text', () => {
    const text = formatDrift('render.yaml', drift({}));

    expect(text).toContain('render.yaml has drifted from the blueprint.');
    expect(text).toContain('not offsets into either file');
    expect(text).toContain('--- committed render.yaml (normalized)');
    expect(text).toContain('+++ generated from the blueprint (normalized)');
  });

  it('prints the diff verbatim', () => {
    expect(formatDrift('render.yaml', drift({}))).toContain(
      '@@ -4,1 +4,1 @@\n-    plan: starter\n+    plan: standard',
    );
  });

  it('prints the parse errors before the diff', () => {
    const text = formatDrift(
      'render.yaml',
      drift({ parseErrors: ['Unexpected scalar at line 2'] }),
    );

    expect(text).toContain('  Unexpected scalar at line 2');
    expect(text.indexOf('Unexpected scalar')).toBeLessThan(text.indexOf('@@'));
  });

  it('lists an immutable-field change after the diff with both values', () => {
    const text = formatDrift(
      'render.yaml',
      drift({
        immutableFieldChanges: [
          {
            section: 'services',
            resource: 'api',
            field: 'region',
            committed: '"oregon"',
            generated: '"frankfurt"',
          },
        ],
      }),
    );

    expect(text).toContain('Render cannot change these fields in place:');
    expect(text).toContain('  services "api" region: "oregon" -> "frankfurt"');
    expect(text.indexOf('@@')).toBeLessThan(text.indexOf('Render cannot change'));
  });

  it('says nothing about parse errors or immutable fields when there are none', () => {
    const text = formatDrift('render.yaml', drift({}));

    expect(text).not.toContain('not valid YAML');
    expect(text).not.toContain('Render cannot change');
  });
});
