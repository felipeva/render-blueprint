import * as z from 'zod';

import { boundedInteger, INSTANCE_COUNT_BOUNDS } from '../bounded-integer.js';
import { type ServerPlan } from '../enums/plan.js';
import { previewGenerationSchema, type PreviewGeneration } from '../enums/preview-generation.js';
import type { Equal, Expect } from '../equal.js';

// spec §4.6: a web service, a private service and a worker take all three.
export interface ServicePreviews<P extends ServerPlan = ServerPlan> {
  readonly generation?: PreviewGeneration;
  readonly plan?: P;
  readonly instances?: number;
}

// Emission order follows the schema's servicePreviews property order.
export const SERVICE_PREVIEWS_FIELDS = ['generation', 'plan', 'numInstances'] as const;

const previewsObject = <P extends ServerPlan>(plan: z.ZodType<P>) =>
  z
    .strictObject({
      generation: previewGenerationSchema.exactOptional(),
      plan: plan.exactOptional(),
      instances: boundedInteger(INSTANCE_COUNT_BOUNDS).exactOptional(),
    })
    .readonly();

// The guard needs a concrete instantiation, because a generic builder has no one inferred type to
// compare.
type ServicePreviewsSchemaMatchesInterface = Expect<
  Equal<z.infer<ReturnType<typeof previewsObject<ServerPlan>>>, ServicePreviews<ServerPlan>>
>;

export const SERVICE_PREVIEWS_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies ServicePreviewsSchemaMatchesInterface;

export const servicePreviewsSchema = <P extends ServerPlan>(
  plan: z.ZodType<P>,
): z.ZodType<ServicePreviews<P>> => previewsObject(plan);
