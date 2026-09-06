import * as z from 'zod';

import { maxmemoryPolicySchema, type MaxmemoryPolicy } from '../enums/maxmemory-policy.js';
import { keyValuePlanSchema, type KeyValuePlan } from '../enums/plan.js';
import { regionSchema, type Region } from '../enums/region.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { keyValueReference, type KeyValueReference } from '../references/key-value-reference.js';
import type { IpAllowList } from './ip-allow-list.js';

export interface KeyValueConfig {
  readonly ipAllowList: IpAllowList;
  readonly region?: Region;
  readonly plan?: KeyValuePlan;
  readonly maxmemoryPolicy?: MaxmemoryPolicy;
  readonly extraFields?: JsonObject;
}

export interface KeyValueStore extends KeyValueReference {
  readonly kind: 'keyValue';
  readonly name: string;
  readonly config: KeyValueConfig;
}

// Emission order follows the schema's redisServer property order.
export const KEY_VALUE_STORE_FIELDS = [
  'type',
  'name',
  'region',
  'ipAllowList',
  'plan',
  'maxmemoryPolicy',
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
    maxmemoryPolicy: maxmemoryPolicySchema.exactOptional(),
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
