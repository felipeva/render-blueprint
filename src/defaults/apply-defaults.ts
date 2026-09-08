import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import type {
  CronPlan,
  KeyValuePlan,
  PaidServerPlan,
  PostgresPlan,
  ServerPlan,
} from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import type { BuildFilter } from '../resources/build-filter.js';
import type { CronConfig } from '../resources/cron.js';
import type {
  AppliedDefault,
  DefaultField,
  DefaultKey,
  DefaultsDeclaration,
} from '../resources/defaults-provenance.js';
import type { IpAllowList } from '../resources/ip-allow-list.js';
import type { KeyValueConfig } from '../resources/key-value.js';
import type { PostgresConfig } from '../resources/postgres.js';
import type { PrivateServiceConfig } from '../resources/private-service.js';
import { repoSource, type ServiceSource } from '../resources/service-source.js';
import type { StaticSiteConfig } from '../resources/static-site.js';
import type { WebConfig } from '../resources/web.js';
import type { WorkerConfig } from '../resources/worker.js';
import type { PlanDefaults, ResourceDefaults } from './resource-defaults.js';

export interface Filled<V> {
  readonly value: V;
  readonly scope: DefaultsDeclaration;
}

type Scoped<T> = { readonly [K in keyof T]-?: Filled<NonNullable<T[K]>> | undefined };

export type ScopePlans = Scoped<PlanDefaults>;

export interface ScopeValues extends Scoped<Omit<ResourceDefaults, 'plan'>> {
  readonly plan: ScopePlans;
}

export interface AppliedConfig<T> {
  readonly config: T;
  readonly eligible: readonly DefaultKey[];
  readonly applied: readonly AppliedDefault[];
}

interface Marks {
  readonly eligible: DefaultKey[];
  readonly applied: AppliedDefault[];
}

interface RepoFill {
  repo?: string;
  branch?: string;
  rootDir?: string;
}

interface RepoFields {
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
}

// spec §4.1: both fields govern what a push to the repository builds.
interface BuildFill {
  autoDeployTrigger?: AutoDeployTrigger;
  buildFilter?: BuildFilter;
}

interface BuildFields {
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly buildFilter?: BuildFilter;
}

interface AllowListFill {
  ipAllowList?: IpAllowList;
}

interface SourcedFill<P extends string> extends RepoFill, BuildFill {
  region?: Region;
  plan?: P;
}

interface SourcedFields<P extends string> {
  readonly region?: Region;
  readonly plan?: P;
}

interface WebFill extends SourcedFill<ServerPlan>, AllowListFill {}

interface StaticSiteFill extends RepoFill, BuildFill, AllowListFill {}

interface DatastoreFill<P extends string> {
  region?: Region;
  plan?: P;
}

interface PostgresFill extends DatastoreFill<PostgresPlan>, AllowListFill {}

const appliedDefault = (
  key: DefaultKey,
  field: DefaultField,
  scope: DefaultsDeclaration,
): AppliedDefault => ({ key, field, scope });

const fillRegion = (
  values: ScopeValues,
  own: Region | undefined,
  fill: { region?: Region },
  marks: Marks,
): void => {
  if (values.region === undefined) return;

  marks.eligible.push('region');
  if (own !== undefined) return;

  fill.region = values.region.value;
  marks.applied.push(appliedDefault('region', 'region', values.region.scope));
};

const fillPlan = <P extends string>(
  plan: Filled<P> | undefined,
  key: DefaultKey,
  own: P | undefined,
  fill: { plan?: P },
  marks: Marks,
): void => {
  if (plan === undefined) return;

  marks.eligible.push(key);
  if (own !== undefined) return;

  fill.plan = plan.value;
  marks.applied.push(appliedDefault(key, 'plan', plan.scope));
};

const fillRepo = (values: ScopeValues, own: RepoFields, fill: RepoFill, marks: Marks): void => {
  if (values.repo !== undefined) {
    marks.eligible.push('repo');

    if (own.repo === undefined) {
      fill.repo = values.repo.value;
      marks.applied.push(appliedDefault('repo', 'repo', values.repo.scope));
    }
  }

  if (values.branch !== undefined) {
    marks.eligible.push('branch');

    if (own.branch === undefined) {
      fill.branch = values.branch.value;
      marks.applied.push(appliedDefault('branch', 'branch', values.branch.scope));
    }
  }

  if (values.rootDir !== undefined) {
    marks.eligible.push('rootDir');

    if (own.rootDir === undefined) {
      fill.rootDir = values.rootDir.value;
      marks.applied.push(appliedDefault('rootDir', 'rootDir', values.rootDir.scope));
    }
  }
};

const fillBuild = (values: ScopeValues, own: BuildFields, fill: BuildFill, marks: Marks): void => {
  if (values.autoDeployTrigger !== undefined) {
    marks.eligible.push('autoDeployTrigger');

    if (own.autoDeployTrigger === undefined) {
      fill.autoDeployTrigger = values.autoDeployTrigger.value;
      marks.applied.push(
        appliedDefault('autoDeployTrigger', 'autoDeployTrigger', values.autoDeployTrigger.scope),
      );
    }
  }

  if (values.buildFilter !== undefined) {
    marks.eligible.push('buildFilter');

    if (own.buildFilter === undefined) {
      fill.buildFilter = values.buildFilter.value;
      marks.applied.push(appliedDefault('buildFilter', 'buildFilter', values.buildFilter.scope));
    }
  }
};

// spec §7: a web service, a static site and a Postgres database take an optional list.
const fillIpAllowList = (
  values: ScopeValues,
  own: IpAllowList | undefined,
  fill: AllowListFill,
  marks: Marks,
): void => {
  if (values.ipAllowList === undefined) return;

  marks.eligible.push('ipAllowList');
  if (own !== undefined) return;

  fill.ipAllowList = values.ipAllowList.value;
  marks.applied.push(appliedDefault('ipAllowList', 'ipAllowList', values.ipAllowList.scope));
};

// spec §4.3: an image source names no repository.
const fillFromRepository = (
  values: ScopeValues,
  config: BuildFields & ServiceSource,
  fill: RepoFill & BuildFill,
  marks: Marks,
): void => {
  const source = repoSource(config);
  if (source === undefined) return;

  fillRepo(values, source, fill, marks);
  fillBuild(values, config, fill, marks);
};

const fillSourced = <P extends string>(
  values: ScopeValues,
  config: SourcedFields<P> & BuildFields & ServiceSource,
  plan: Filled<P> | undefined,
  key: DefaultKey,
  fill: SourcedFill<P>,
  marks: Marks,
): void => {
  fillRegion(values, config.region, fill, marks);
  fillPlan(plan, key, config.plan, fill, marks);
  fillFromRepository(values, config, fill, marks);
};

// spec §9 and §5: neither a database nor a Key Value instance builds from a repository.
const fillDatastore = <P extends string>(
  values: ScopeValues,
  config: SourcedFields<P>,
  plan: Filled<P> | undefined,
  key: DefaultKey,
  fill: DatastoreFill<P>,
  marks: Marks,
): void => {
  fillRegion(values, config.region, fill, marks);
  fillPlan(plan, key, config.plan, fill, marks);
};

export const webDefaults = (values: ScopeValues, config: WebConfig): AppliedConfig<WebConfig> => {
  const fill: WebFill = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillSourced(values, config, values.plan.web, 'plan.web', fill, marks);
  fillIpAllowList(values, config.ipAllowList, fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

// spec §16 F: an allow list sits on the web branch alone among the four sourced kinds.
export const privateServiceDefaults = (
  values: ScopeValues,
  config: PrivateServiceConfig,
): AppliedConfig<PrivateServiceConfig> => {
  const fill: SourcedFill<PaidServerPlan> = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillSourced(values, config, values.plan.privateService, 'plan.privateService', fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

export const workerDefaults = (
  values: ScopeValues,
  config: WorkerConfig,
): AppliedConfig<WorkerConfig> => {
  const fill: SourcedFill<PaidServerPlan> = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillSourced(values, config, values.plan.worker, 'plan.worker', fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

export const cronDefaults = (
  values: ScopeValues,
  config: CronConfig,
): AppliedConfig<CronConfig> => {
  const fill: SourcedFill<CronPlan> = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillSourced(values, config, values.plan.cron, 'plan.cron', fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

// spec §4.8 and §8.1: a static site runs nowhere and takes no plan.
export const staticSiteDefaults = (
  values: ScopeValues,
  config: StaticSiteConfig,
): AppliedConfig<StaticSiteConfig> => {
  const fill: StaticSiteFill = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillRepo(values, config, fill, marks);
  fillBuild(values, config, fill, marks);
  fillIpAllowList(values, config.ipAllowList, fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

export const keyValueDefaults = (
  values: ScopeValues,
  config: KeyValueConfig,
): AppliedConfig<KeyValueConfig> => {
  const fill: DatastoreFill<KeyValuePlan> = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillDatastore(values, config, values.plan.keyValue, 'plan.keyValue', fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

export const postgresDefaults = (
  values: ScopeValues,
  config: PostgresConfig,
): AppliedConfig<PostgresConfig> => {
  const fill: PostgresFill = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillDatastore(values, config, values.plan.postgres, 'plan.postgres', fill, marks);
  fillIpAllowList(values, config.ipAllowList, fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};
