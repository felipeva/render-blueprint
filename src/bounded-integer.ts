import * as z from 'zod';

import { raise } from './raise.js';

export interface IntegerBounds {
  readonly subject: string;
  readonly min: number;
  readonly max?: number;
}

const message = (bounds: IntegerBounds, value: number): string =>
  bounds.max === undefined
    ? `${bounds.subject} is an integer of ${bounds.min} or more, and this one is ${value}.`
    : `${bounds.subject} is an integer from ${bounds.min} to ${bounds.max}, and this one is ${value}.`;

// design B §5: numeric ranges are synth-time rules, and one code carries every field the spec
// bounds because the issue path already names the field at fault.
export const boundedInteger = (bounds: IntegerBounds): z.ZodInt =>
  z.int().superRefine((value, ctx) => {
    if (value < bounds.min || (bounds.max !== undefined && value > bounds.max)) {
      raise(ctx, 'OutOfRange', message(bounds, value), []);
    }
  });

export const INSTANCE_COUNT_BOUNDS: IntegerBounds = { subject: 'An instance count', min: 1 };
