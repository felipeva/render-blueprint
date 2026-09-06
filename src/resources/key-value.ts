import * as z from 'zod';

import {
  keyValuePersistenceModeSchema,
  type KeyValuePersistenceMode,
} from '../enums/key-value-persistence-mode.js';
import { maxmemoryPolicySchema, type MaxmemoryPolicy } from '../enums/maxmemory-policy.js';
import { keyValuePlanSchema, type KeyValuePlan } from '../enums/plan.js';
import { regionSchema, type Region } from '../enums/region.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { keyValueReference, type KeyValueReference } from '../references/key-value-reference.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import type { IpAllowList } from './ip-allow-list.js';

// spec §5 and §11: a Key Value instance has no previews object on Render, and previewPlan is the
// current form there rather than a retired one; design B §2.6 renames the field on the way out.
export interface KeyValuePreviews {
  readonly plan?: KeyValuePlan;
}

export interface KeyValueConfig {
  readonly ipAllowList: IpAllowList;
  readonly region?: Region;
  readonly plan?: KeyValuePlan;
  readonly previews?: KeyValuePreviews;
  readonly maxmemoryPolicy?: MaxmemoryPolicy;
  readonly persistenceMode?: KeyValuePersistenceMode;
  readonly extraFields?: JsonObject;
}

export interface KeyValueStore extends KeyValueReference {
  readonly kind: 'keyValue';
  readonly name: string;
  readonly config: KeyValueConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's redisServer property order.
export const KEY_VALUE_STORE_FIELDS = [
  'type',
  'name',
  'region',
  'ipAllowList',
  'plan',
  'previewPlan',
  'maxmemoryPolicy',
  'persistenceMode',
] as const;

const keyValueConfigSchema = z
  .strictObject({
    // spec §5: a Key Value instance is the one resource Render requires an ipAllowList on.
    ipAllowList: z
      .array(
        z.strictObject({ source: z.string(), description: z.string().exactOptional() }).readonly(),
      )
      .readonly(),
    region: regionSchema.exactOptional(),
    plan: keyValuePlanSchema.exactOptional(),
    previews: z
      .strictObject({ plan: keyValuePlanSchema.exactOptional() })
      .readonly()
      .exactOptional(),
    maxmemoryPolicy: maxmemoryPolicySchema.exactOptional(),
    persistenceMode: keyValuePersistenceModeSchema.exactOptional(),
    extraFields: jsonObjectSchema.exactOptional(),
  })
  .readonly();

type KeyValueConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof keyValueConfigSchema>, KeyValueConfig>
>;

export const KEY_VALUE_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies KeyValueConfigSchemaMatchesInterface;

export const parseKeyValueConfig = (config: KeyValueConfig): z.ZodSafeParseResult<KeyValueConfig> =>
  keyValueConfigSchema.safeParse(config);

export const keyValue = (name: string, config: KeyValueConfig): KeyValueStore => ({
  kind: 'keyValue',
  name,
  config,
  ...keyValueReference(name, 'blueprint'),
});
