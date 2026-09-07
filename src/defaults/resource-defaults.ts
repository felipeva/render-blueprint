import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import type {
  CronPlan,
  KeyValuePlan,
  PaidServerPlan,
  PostgresPlan,
  ServerPlan,
} from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import type { Equal, Expect } from '../equal.js';
import type { BuildFilter } from '../resources/build-filter.js';
import type { DefaultKey } from '../resources/defaults-provenance.js';
import type { IpAllowList } from '../resources/ip-allow-list.js';

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

// An object or an array default is written by reference and a resource's own value replaces it
// whole, so the record holds the same declarations a config field takes.
export interface ResourceDefaults {
  readonly region?: Region;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly buildFilter?: BuildFilter;
  readonly ipAllowList?: IpAllowList;
  readonly plan?: PlanDefaults;
}

type DeclarableKey = Exclude<keyof ResourceDefaults, 'plan'> | `plan.${keyof PlanDefaults}`;

type RecordKeysCoverTheDefaultKeys = Expect<Equal<DeclarableKey, DefaultKey>>;

export const RECORD_KEYS_COVER_THE_DEFAULT_KEYS: true =
  true satisfies RecordKeysCoverTheDefaultKeys;
