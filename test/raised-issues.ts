import type * as z from 'zod';

export interface RaisedIssue {
  readonly validationCode: string;
  readonly path: readonly PropertyKey[];
}

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
