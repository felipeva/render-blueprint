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
  readonly eligible: readonly DefaultKey[];
  readonly applied: readonly AppliedDefault[];
}

// What one merge learned: every declared default the kind and the source branch can take, and the
// subset that landed because the resource left the field open. A scope declares a key exactly when
// the chain holds a value for it, so the value being there is the eligibility test.
interface Marks {
  readonly eligible: DefaultKey[];
  readonly applied: AppliedDefault[];
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
// a JavaScript caller meets. Reaching this function is what makes the field eligible, because a
// kind that does not take it never calls in.
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

interface Application<F> {
  readonly fill: F;
  readonly marks: Marks;
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
  const marks: Marks = { eligible: [], applied: [] };

  fillRegion(values, config.region, fill, marks);
  fillPlan(plan, key, config.plan, fill, marks);

  const source = repoSource(config);
  if (source !== undefined) fillRepo(values, source, fill, marks);

  return { fill, marks };
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
  const marks: Marks = { eligible: [], applied: [] };

  fillRegion(values, config.region, fill, marks);
  fillPlan(plan, key, config.plan, fill, marks);

  return { fill, marks };
};

export const webDefaults = (values: ScopeValues, config: WebConfig): AppliedConfig<WebConfig> => {
  const application = sourcedApplication(values, config, values.plan.web, 'plan.web');

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
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

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
};

export const workerDefaults = (
  values: ScopeValues,
  config: WorkerConfig,
): AppliedConfig<WorkerConfig> => {
  const application = sourcedApplication(values, config, values.plan.worker, 'plan.worker');

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
};

export const cronDefaults = (
  values: ScopeValues,
  config: CronConfig,
): AppliedConfig<CronConfig> => {
  const application = sourcedApplication(values, config, values.plan.cron, 'plan.cron');

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
};

// spec §4.8 and §8.1: a static site runs nowhere and takes no plan, so region and plan never reach
// one; it builds from a repository, so the other three do.
export const staticSiteDefaults = (
  values: ScopeValues,
  config: StaticSiteConfig,
): AppliedConfig<StaticSiteConfig> => {
  const fill: RepoFill = {};
  const marks: Marks = { eligible: [], applied: [] };

  fillRepo(values, config, fill, marks);

  return { config: { ...config, ...fill }, eligible: marks.eligible, applied: marks.applied };
};

export const keyValueDefaults = (
  values: ScopeValues,
  config: KeyValueConfig,
): AppliedConfig<KeyValueConfig> => {
  const application = datastoreApplication(values, config, values.plan.keyValue, 'plan.keyValue');

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
};

export const postgresDefaults = (
  values: ScopeValues,
  config: PostgresConfig,
): AppliedConfig<PostgresConfig> => {
  const application = datastoreApplication(values, config, values.plan.postgres, 'plan.postgres');

  return {
    config: { ...config, ...application.fill },
    eligible: application.marks.eligible,
    applied: application.marks.applied,
  };
};
