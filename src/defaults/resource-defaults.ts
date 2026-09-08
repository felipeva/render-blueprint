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
import type { DefaultField, DefaultKey } from '../resources/defaults-provenance.js';
import type { IpAllowList } from '../resources/ip-allow-list.js';

// design B §2.3: one key per kind that has a plan.
export interface PlanDefaults {
  readonly web?: ServerPlan;
  readonly privateService?: PaidServerPlan;
  readonly worker?: PaidServerPlan;
  readonly cron?: CronPlan;
  readonly keyValue?: KeyValuePlan;
  readonly postgres?: PostgresPlan;
}

export const PLAN_KINDS = [
  'web',
  'privateService',
  'worker',
  'cron',
  'keyValue',
  'postgres',
] as const;

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

type PlanKindsCoverThePlanDefaults = Expect<Equal<(typeof PLAN_KINDS)[number], keyof PlanDefaults>>;

export const PLAN_KINDS_COVER_THE_PLAN_DEFAULTS: true =
  true satisfies PlanKindsCoverThePlanDefaults;

type DefaultFieldsCoverTheRecordKeys = Expect<Equal<DefaultField, keyof ResourceDefaults>>;

export const DEFAULT_FIELDS_COVER_THE_RECORD_KEYS: true =
  true satisfies DefaultFieldsCoverTheRecordKeys;
