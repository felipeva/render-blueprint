import type {
  CronPlan,
  KeyValuePlan,
  PaidServerPlan,
  PostgresPlan,
  ServerPlan,
} from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import type { Equal, Expect } from '../equal.js';
import type { DefaultKey } from '../resources/defaults-provenance.js';

// design B §2.3: one key per kind that has a plan, because the four plan enums differ and cannot
// share a slot. A static site has no plan, so it has no key here.
export interface PlanDefaults {
  readonly web?: ServerPlan;
  readonly privateService?: PaidServerPlan;
  readonly worker?: PaidServerPlan;
  readonly cron?: CronPlan;
  readonly keyValue?: KeyValuePlan;
  readonly postgres?: PostgresPlan;
}

export interface ResourceDefaults {
  readonly region?: Region;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly plan?: PlanDefaults;
}

type DeclarableKey = Exclude<keyof ResourceDefaults, 'plan'> | `plan.${keyof PlanDefaults}`;

type RecordKeysCoverTheDefaultKeys = Expect<Equal<DeclarableKey, DefaultKey>>;

export const RECORD_KEYS_COVER_THE_DEFAULT_KEYS: true =
  true satisfies RecordKeysCoverTheDefaultKeys;
