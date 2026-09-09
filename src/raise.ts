import type * as z from 'zod';

export const raise = <T>(
  ctx: z.core.$RefinementCtx<T>,
  validationCode: string,
  message: string,
  path: readonly PropertyKey[],
): void => {
  ctx.addIssue({ code: 'custom', message, params: { validationCode }, path: [...path] });
};

export interface RefinementOptions {
  readonly when: (payload: z.core.ParsePayload) => boolean;
}

const aborting = (issue: z.core.$ZodRawIssue): boolean => issue.continue !== true;

const onValueOrField = (issue: z.core.$ZodRawIssue, fields: readonly string[]): boolean => {
  const path = issue.path ?? [];

  return path.length === 0 || (path.length === 1 && fields.includes(String(path[0])));
};

export const whenFieldsParsed = (fields: readonly string[]): RefinementOptions => ({
  when: (payload) =>
    !payload.issues.some((issue) => aborting(issue) && onValueOrField(issue, fields)),
});

export const whenValueParsed: RefinementOptions = {
  when: (payload) => payload.issues.length === 0,
};
