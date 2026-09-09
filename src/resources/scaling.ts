import * as z from 'zod';

import { boundedInteger, INSTANCE_COUNT_BOUNDS, type IntegerBounds } from '../bounded-integer.js';
import type { Equal, Expect } from '../equal.js';
import { raise, whenFieldsParsed } from '../raise.js';

// spec §4.5: the published schema requires none of the four.
export interface Scaling {
  readonly minInstances: number;
  readonly maxInstances: number;
  readonly targetMemoryPercent?: number;
  readonly targetCPUPercent?: number;
}

// Emission order follows the schema's scaling property order.
export const SCALING_FIELDS = [
  'minInstances',
  'maxInstances',
  'targetMemoryPercent',
  'targetCPUPercent',
] as const;

const TARGET_PERCENT_BOUNDS: IntegerBounds = { subject: 'A scaling target', min: 1, max: 90 };

const scalingObject = z
  .strictObject({
    minInstances: boundedInteger(INSTANCE_COUNT_BOUNDS),
    maxInstances: boundedInteger(INSTANCE_COUNT_BOUNDS),
    targetMemoryPercent: boundedInteger(TARGET_PERCENT_BOUNDS).exactOptional(),
    targetCPUPercent: boundedInteger(TARGET_PERCENT_BOUNDS).exactOptional(),
  })
  .readonly()
  .superRefine(
    (value, ctx) => {
      if (value.minInstances > value.maxInstances) {
        raise(
          ctx,
          'ScalingRangeInverted',
          `Autoscaling runs between minInstances and maxInstances, and this range starts at ${value.minInstances} and ends at ${value.maxInstances}.`,
          ['maxInstances'],
        );
      }
    },
    whenFieldsParsed(['minInstances', 'maxInstances']),
  )
  .superRefine(
    (value, ctx) => {
      if (value.targetCPUPercent === undefined && value.targetMemoryPercent === undefined) {
        raise(
          ctx,
          'ScalingTargetMissing',
          'Autoscaling scales towards a target metric, so scaling carries targetCPUPercent, targetMemoryPercent, or both.',
          [],
        );
      }
    },
    whenFieldsParsed(['targetCPUPercent', 'targetMemoryPercent']),
  );

type ScalingSchemaMatchesInterface = Expect<Equal<z.infer<typeof scalingObject>, Scaling>>;

export const SCALING_SCHEMA_MATCHES_INTERFACE: true = true satisfies ScalingSchemaMatchesInterface;

export const scalingSchema: z.ZodType<Scaling> = scalingObject;
