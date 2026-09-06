import type * as z from 'zod';

export const raise = <T>(
  ctx: z.core.$RefinementCtx<T>,
  validationCode: string,
  message: string,
  path: readonly PropertyKey[],
): void => {
  ctx.addIssue({ code: 'custom', message, params: { validationCode }, path: [...path] });
};
