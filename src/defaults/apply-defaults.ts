import type {
  CronPlan,
  KeyValuePlan,
  PaidServerPlan,
  PostgresPlan,
  ServerPlan,
} from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import type { CronConfig } from '../resources/cron.js';
import type {
  AppliedDefault,
  DefaultField,
  DefaultKey,
  DefaultsDeclaration,
} from '../resources/defaults-provenance.js';
import type { KeyValueConfig } from '../resources/key-value.js';
import type { PostgresConfig } from '../resources/postgres.js';
import type { PrivateServiceConfig } from '../resources/private-service.js';
import { repoSource, type ServiceSource } from '../resources/service-source.js';
import type { StaticSiteConfig } from '../resources/static-site.js';
import type { WebConfig } from '../resources/web.js';
import type { WorkerConfig } from '../resources/worker.js';

// A default value and the innermost scope that declared it. A nested scope resolves attribution
// once, when it is built, so the merge never walks the chain.
export interface Filled<V> {
  readonly value: V;
  readonly scope: DefaultsDeclaration;
}

export interface ScopePlans {
  readonly web: Filled<ServerPlan> | undefined;
  readonly privateService: Filled<PaidServerPlan> | undefined;
  readonly worker: Filled<PaidServerPlan> | undefined;
  readonly cron: Filled<CronPlan> | undefined;
  readonly keyValue: Filled<KeyValuePlan> | undefined;
  readonly postgres: Filled<PostgresPlan> | undefined;
}

export interface ScopeValues {
  readonly region: Filled<Region> | undefined;
  readonly repo: Filled<string> | undefined;
  readonly branch: Filled<string> | undefined;
  readonly rootDir: Filled<string> | undefined;
  readonly plan: ScopePlans;
}

export interface AppliedConfig<T> {
  readonly config: T;
  readonly applied: readonly AppliedDefault[];
}

// The three fields a repository-built source takes. A prebuilt image takes none of them.
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

interface SourcedFill<P extends string> extends RepoFill {
  region?: Region;
  plan?: P;
}

interface SourcedFields<P extends string> {
  readonly region?: Region;
  readonly plan?: P;
}

interface DatastoreFill<P extends string> {
  region?: Region;
  plan?: P;
}

const appliedDefault = (
  key: DefaultKey,
  field: DefaultField,
  scope: DefaultsDeclaration,
): AppliedDefault => ({ key, field, scope });

// A key the author wrote wins, and a key written as undefined is no value at all, so the scope
// fills it: exactOptionalPropertyTypes makes that unreachable from TypeScript and the merge is what
// a JavaScript caller meets.
const fillRegion = (
  values: ScopeValues,
  own: Region | undefined,
  fill: { region?: Region },
  applied: AppliedDefault[],
): void => {
  if (own !== undefined || values.region === undefined) return;

  fill.region = values.region.value;
  applied.push(appliedDefault('region', 'region', values.region.scope));
};

const fillPlan = <P extends string>(
  plan: Filled<P> | undefined,
  key: DefaultKey,
  own: P | undefined,
  fill: { plan?: P },
  applied: AppliedDefault[],
): void => {
  if (own !== undefined || plan === undefined) return;

  fill.plan = plan.value;
  applied.push(appliedDefault(key, 'plan', plan.scope));
};

const fillRepo = (
  values: ScopeValues,
  own: RepoFields,
  fill: RepoFill,
  applied: AppliedDefault[],
): void => {
  if (own.repo === undefined && values.repo !== undefined) {
    fill.repo = values.repo.value;
    applied.push(appliedDefault('repo', 'repo', values.repo.scope));
  }

  if (own.branch === undefined && values.branch !== undefined) {
    fill.branch = values.branch.value;
    applied.push(appliedDefault('branch', 'branch', values.branch.scope));
  }

  if (own.rootDir === undefined && values.rootDir !== undefined) {
    fill.rootDir = values.rootDir.value;
    applied.push(appliedDefault('rootDir', 'rootDir', values.rootDir.scope));
  }
};

interface Application<F> {
  readonly fill: F;
  readonly applied: readonly AppliedDefault[];
}

// The four kinds that choose a source take region, their own plan, and — on the two branches that
// build from a repository — repo, branch and rootDir. spec §4.3: an image source names no
// repository, so `runtime` deciding the branch is what keeps a repo default off it.
const sourcedApplication = <P extends string>(
  values: ScopeValues,
  config: SourcedFields<P> & ServiceSource,
  plan: Filled<P> | undefined,
  key: DefaultKey,
): Application<SourcedFill<P>> => {
  const fill: SourcedFill<P> = {};
  const applied: AppliedDefault[] = [];

  fillRegion(values, config.region, fill, applied);
  fillPlan(plan, key, config.plan, fill, applied);

  const source = repoSource(config);
  if (source !== undefined) fillRepo(values, source, fill, applied);

  return { fill, applied };
};

// spec §9 and §5: neither a database nor a Key Value instance builds from a repository, so repo,
// branch and rootDir never reach one.
const datastoreApplication = <P extends string>(
  values: ScopeValues,
  config: SourcedFields<P>,
  plan: Filled<P> | undefined,
  key: DefaultKey,
): Application<DatastoreFill<P>> => {
  const fill: DatastoreFill<P> = {};
  const applied: AppliedDefault[] = [];

  fillRegion(values, config.region, fill, applied);
  fillPlan(plan, key, config.plan, fill, applied);

  return { fill, applied };
};

export const webDefaults = (values: ScopeValues, config: WebConfig): AppliedConfig<WebConfig> => {
  const application = sourcedApplication(values, config, values.plan.web, 'plan.web');

  return { config: { ...config, ...application.fill }, applied: application.applied };
};

export const privateServiceDefaults = (
  values: ScopeValues,
  config: PrivateServiceConfig,
): AppliedConfig<PrivateServiceConfig> => {
  const application = sourcedApplication(
    values,
    config,
    values.plan.privateService,
    'plan.privateService',
  );

  return { config: { ...config, ...application.fill }, applied: application.applied };
};

export const workerDefaults = (
  values: ScopeValues,
  config: WorkerConfig,
): AppliedConfig<WorkerConfig> => {
  const application = sourcedApplication(values, config, values.plan.worker, 'plan.worker');

  return { config: { ...config, ...application.fill }, applied: application.applied };
};

export const cronDefaults = (
  values: ScopeValues,
  config: CronConfig,
): AppliedConfig<CronConfig> => {
  const application = sourcedApplication(values, config, values.plan.cron, 'plan.cron');

  return { config: { ...config, ...application.fill }, applied: application.applied };
};

// spec §4.8 and §8.1: a static site runs nowhere and takes no plan, so region and plan never reach
// one; it builds from a repository, so the other three do.
export const staticSiteDefaults = (
  values: ScopeValues,
  config: StaticSiteConfig,
): AppliedConfig<StaticSiteConfig> => {
  const fill: RepoFill = {};
  const applied: AppliedDefault[] = [];

  fillRepo(values, config, fill, applied);

  return { config: { ...config, ...fill }, applied };
};

export const keyValueDefaults = (
  values: ScopeValues,
  config: KeyValueConfig,
): AppliedConfig<KeyValueConfig> => {
  const application = datastoreApplication(values, config, values.plan.keyValue, 'plan.keyValue');

  return { config: { ...config, ...application.fill }, applied: application.applied };
};

export const postgresDefaults = (
  values: ScopeValues,
  config: PostgresConfig,
): AppliedConfig<PostgresConfig> => {
  const application = datastoreApplication(values, config, values.plan.postgres, 'plan.postgres');

  return { config: { ...config, ...application.fill }, applied: application.applied };
};
