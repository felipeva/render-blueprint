import * as z from 'zod';

import { boundedInteger, INSTANCE_COUNT_BOUNDS } from '../bounded-integer.js';
import type { ServerPlan } from '../enums/plan.js';
import { previewGenerationSchema, type PreviewGeneration } from '../enums/preview-generation.js';

// spec §4.6: a web service, a private service and a worker take all three; the plan a preview
// instance runs on is the plan set of the kind that declares it.
export interface ServicePreviews<P extends ServerPlan = ServerPlan> {
  readonly generation?: PreviewGeneration;
  readonly plan?: P;
  readonly instances?: number;
}

// Emission order follows the schema's servicePreviews property order.
export const SERVICE_PREVIEWS_FIELDS = ['generation', 'plan', 'numInstances'] as const;

export const servicePreviewsSchema = <P extends ServerPlan>(
  plan: z.ZodType<P>,
): z.ZodType<ServicePreviews<P>> =>
  z
    .strictObject({
      generation: previewGenerationSchema.exactOptional(),
      plan: plan.exactOptional(),
      instances: boundedInteger(INSTANCE_COUNT_BOUNDS).exactOptional(),
    })
    .readonly();
