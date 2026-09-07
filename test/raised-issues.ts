import type * as z from 'zod';

export interface RaisedIssue {
  readonly validationCode: string;
  readonly path: readonly PropertyKey[];
}

// The issues a config schema raised through the shared raise helper, each carrying the
// ValidationCode the refinement named. A rejection no refinement raised names no code and is not
// one of these, so a test that asserts on this list asserts on the value rules alone.
export const raisedIssuesThrough =
  <T>(parse: (config: T) => z.ZodSafeParseResult<T>): ((config: T) => readonly RaisedIssue[]) =>
  (config) => {
    const result = parse(config);
    if (result.success) return [];

    return result.error.issues.flatMap((issue): readonly RaisedIssue[] =>
      issue.code === 'custom'
        ? [{ validationCode: String(issue.params?.['validationCode']), path: issue.path }]
        : [],
    );
  };
