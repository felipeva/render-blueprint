import { describe, expect, it } from 'vitest';

import type { BuildFilter } from '../resources/build-filter.js';
import type { DefaultsDeclaration } from '../resources/defaults-provenance.js';
import type { IpAllowList } from '../resources/ip-allow-list.js';
import type { WebConfig } from '../resources/web.js';
import {
  cronDefaults,
  keyValueDefaults,
  postgresDefaults,
  privateServiceDefaults,
  staticSiteDefaults,
  webDefaults,
  workerDefaults,
  type ScopeValues,
} from './apply-defaults.js';

const scope: DefaultsDeclaration = { keys: [] };

const FILTER: BuildFilter = { paths: ['apps/**'], ignoredPaths: ['docs/**'] };

const OFFICE: IpAllowList = [{ source: '203.0.113.0/24', description: 'office' }];

const every: ScopeValues = {
  region: { value: 'frankfurt', scope },
  repo: { value: 'https://github.com/acme/mono', scope },
  branch: { value: 'main', scope },
  rootDir: { value: 'apps/api', scope },
  autoDeployTrigger: { value: 'checksPass', scope },
  buildFilter: { value: FILTER, scope },
  ipAllowList: { value: OFFICE, scope },
  plan: {
    web: { value: 'standard', scope },
    privateService: { value: 'starter', scope },
    worker: { value: 'pro', scope },
    cron: { value: 'starter', scope },
    keyValue: { value: 'pro plus', scope },
    postgres: { value: 'pro-8gb', scope },
  },
};

const REPOSITORY = {
  repo: 'https://github.com/acme/mono',
  branch: 'main',
  rootDir: 'apps/api',
};

const BUILD = { autoDeployTrigger: 'checksPass', buildFilter: FILTER } as const;

const REPOSITORY_KEYS = ['repo', 'branch', 'rootDir'] as const;

const BUILD_KEYS = ['autoDeployTrigger', 'buildFilter'] as const;

describe('webDefaults', () => {
  it('fills every key the native branch of a web service takes', () => {
    const merged = webDefaults(every, { runtime: 'node' });

    expect(merged.config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'standard',
      ...REPOSITORY,
      ...BUILD,
      ipAllowList: OFFICE,
    });
    expect(merged.eligible).toEqual([
      'region',
      'plan.web',
      ...REPOSITORY_KEYS,
      ...BUILD_KEYS,
      'ipAllowList',
    ]);
  });

  it('fills every key the Docker branch of a web service takes', () => {
    const merged = webDefaults(every, { runtime: 'docker' });

    expect(merged.config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'standard',
      ...REPOSITORY,
      ...BUILD,
      ipAllowList: OFFICE,
    });
    expect(merged.eligible).toEqual([
      'region',
      'plan.web',
      ...REPOSITORY_KEYS,
      ...BUILD_KEYS,
      'ipAllowList',
    ]);
  });

  it('fills neither a repository field nor a build field on an image source', () => {
    const merged = webDefaults(every, { runtime: 'image', image: { url: 'acme/api:1.4.0' } });

    expect(merged.config).toEqual({
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
      region: 'frankfurt',
      plan: 'standard',
      ipAllowList: OFFICE,
    });
    expect(merged.eligible).toEqual(['region', 'plan.web', 'ipAllowList']);
  });

  it('leaves every value the resource sets for itself', () => {
    expect(
      webDefaults(every, {
        runtime: 'node',
        region: 'ohio',
        plan: 'free',
        repo: 'https://github.com/acme/api',
        branch: 'release',
        rootDir: 'api',
        autoDeployTrigger: 'off',
        buildFilter: { paths: ['api/**'] },
        ipAllowList: [],
      }).config,
    ).toEqual({
      runtime: 'node',
      region: 'ohio',
      plan: 'free',
      repo: 'https://github.com/acme/api',
      branch: 'release',
      rootDir: 'api',
      autoDeployTrigger: 'off',
      buildFilter: { paths: ['api/**'] },
      ipAllowList: [],
    });
  });

  it('replaces an object default whole rather than merging it', () => {
    const merged = webDefaults(every, { runtime: 'node', buildFilter: { paths: ['api/**'] } });

    expect(merged.config.buildFilter).toEqual({ paths: ['api/**'] });
  });

  it('replaces an array default whole rather than joining the entries', () => {
    const merged = webDefaults(every, {
      runtime: 'node',
      ipAllowList: [{ source: '198.51.100.1' }],
    });

    expect(merged.config.ipAllowList).toEqual([{ source: '198.51.100.1' }]);
  });

  it('writes an object default by reference', () => {
    expect(webDefaults(every, { runtime: 'node' }).config.buildFilter).toBe(FILTER);
    expect(webDefaults(every, { runtime: 'node' }).config.ipAllowList).toBe(OFFICE);
  });

  it('fills a field written as undefined, which is no value', () => {
    // @ts-expect-error exactOptionalPropertyTypes rejects this; a JavaScript caller can still write it.
    const config: WebConfig = { runtime: 'node', region: undefined, buildFilter: undefined };

    expect(webDefaults(every, config).config.region).toBe('frankfurt');
    expect(webDefaults(every, config).config.buildFilter).toBe(FILTER);
  });

  it('reports every default it applied, attributed to the scope that declared it', () => {
    expect(webDefaults(every, { runtime: 'node' }).applied).toEqual([
      { key: 'region', field: 'region', scope },
      { key: 'plan.web', field: 'plan', scope },
      { key: 'repo', field: 'repo', scope },
      { key: 'branch', field: 'branch', scope },
      { key: 'rootDir', field: 'rootDir', scope },
      { key: 'autoDeployTrigger', field: 'autoDeployTrigger', scope },
      { key: 'buildFilter', field: 'buildFilter', scope },
      { key: 'ipAllowList', field: 'ipAllowList', scope },
    ]);
  });

  it('reports the fields it filled and no others', () => {
    expect(webDefaults(every, { runtime: 'node' }).applied.map((entry) => entry.field)).toEqual([
      'region',
      'plan',
      'repo',
      'branch',
      'rootDir',
      'autoDeployTrigger',
      'buildFilter',
      'ipAllowList',
    ]);
  });

  it('reports a default the resource overrode as eligible and not applied', () => {
    const merged = webDefaults(every, { runtime: 'node', region: 'ohio', buildFilter: {} });

    expect(merged.eligible).toEqual([
      'region',
      'plan.web',
      ...REPOSITORY_KEYS,
      ...BUILD_KEYS,
      'ipAllowList',
    ]);
    expect(merged.applied.map((entry) => entry.key)).toEqual([
      'plan.web',
      'repo',
      'branch',
      'rootDir',
      'autoDeployTrigger',
      'ipAllowList',
    ]);
  });
});

describe('privateServiceDefaults', () => {
  it('fills every key the native branch of a private service takes', () => {
    const merged = privateServiceDefaults(every, { runtime: 'node' });

    expect(merged.config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual([
      'region',
      'plan.privateService',
      ...REPOSITORY_KEYS,
      ...BUILD_KEYS,
    ]);
  });

  it('fills every key the Docker branch of a private service takes', () => {
    const merged = privateServiceDefaults(every, { runtime: 'docker' });

    expect(merged.config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual([
      'region',
      'plan.privateService',
      ...REPOSITORY_KEYS,
      ...BUILD_KEYS,
    ]);
  });

  it('fills neither a repository field nor a build field on an image source', () => {
    const merged = privateServiceDefaults(every, {
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
    });

    expect(merged.config).toEqual({
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
      region: 'frankfurt',
      plan: 'starter',
    });
    expect(merged.eligible).toEqual(['region', 'plan.privateService']);
  });
});

describe('workerDefaults', () => {
  it('fills every key the native branch of a worker takes', () => {
    const merged = workerDefaults(every, { runtime: 'node' });

    expect(merged.config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'pro',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual(['region', 'plan.worker', ...REPOSITORY_KEYS, ...BUILD_KEYS]);
  });

  it('fills every key the Docker branch of a worker takes', () => {
    const merged = workerDefaults(every, { runtime: 'docker' });

    expect(merged.config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'pro',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual(['region', 'plan.worker', ...REPOSITORY_KEYS, ...BUILD_KEYS]);
  });

  it('fills neither a repository field nor a build field on an image source', () => {
    const merged = workerDefaults(every, { runtime: 'image', image: { url: 'acme/jobs:1.4.0' } });

    expect(merged.config).toEqual({
      runtime: 'image',
      image: { url: 'acme/jobs:1.4.0' },
      region: 'frankfurt',
      plan: 'pro',
    });
    expect(merged.eligible).toEqual(['region', 'plan.worker']);
  });
});

describe('cronDefaults', () => {
  it('fills every key the native branch of a cron job takes', () => {
    const merged = cronDefaults(every, { runtime: 'node', schedule: '0 * * * *' });

    expect(merged.config).toEqual({
      runtime: 'node',
      schedule: '0 * * * *',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual(['region', 'plan.cron', ...REPOSITORY_KEYS, ...BUILD_KEYS]);
  });

  it('fills every key the Docker branch of a cron job takes', () => {
    const merged = cronDefaults(every, { runtime: 'docker', schedule: '0 * * * *' });

    expect(merged.config).toEqual({
      runtime: 'docker',
      schedule: '0 * * * *',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
      ...BUILD,
    });
    expect(merged.eligible).toEqual(['region', 'plan.cron', ...REPOSITORY_KEYS, ...BUILD_KEYS]);
  });

  it('fills neither a repository field nor a build field on an image source', () => {
    const merged = cronDefaults(every, {
      runtime: 'image',
      schedule: '0 * * * *',
      image: { url: 'acme/nightly:1.4.0' },
    });

    expect(merged.config).toEqual({
      runtime: 'image',
      schedule: '0 * * * *',
      image: { url: 'acme/nightly:1.4.0' },
      region: 'frankfurt',
      plan: 'starter',
    });
    expect(merged.eligible).toEqual(['region', 'plan.cron']);
  });
});

describe('staticSiteDefaults', () => {
  it('fills every key a static site takes and neither a region nor a plan', () => {
    const merged = staticSiteDefaults(every, { buildCommand: 'pnpm build' });

    expect(merged.config).toEqual({
      buildCommand: 'pnpm build',
      ...REPOSITORY,
      ...BUILD,
      ipAllowList: OFFICE,
    });
    expect(merged.eligible).toEqual([...REPOSITORY_KEYS, ...BUILD_KEYS, 'ipAllowList']);
  });

  it('leaves the build filter the site sets for itself', () => {
    const merged = staticSiteDefaults(every, { buildFilter: { paths: ['site/**'] } });

    expect(merged.config.buildFilter).toEqual({ paths: ['site/**'] });
    expect(merged.applied.map((entry) => entry.key)).toEqual([
      'repo',
      'branch',
      'rootDir',
      'autoDeployTrigger',
      'ipAllowList',
    ]);
  });
});

describe('keyValueDefaults', () => {
  it('fills the region and the plan and no other key', () => {
    const merged = keyValueDefaults(every, { ipAllowList: [] });

    expect(merged.config).toEqual({ ipAllowList: [], region: 'frankfurt', plan: 'pro plus' });
    expect(merged.eligible).toEqual(['region', 'plan.keyValue']);
  });

  it('leaves the required allow list of the store alone', () => {
    expect(keyValueDefaults(every, { ipAllowList: [] }).config.ipAllowList).toEqual([]);
  });
});

describe('postgresDefaults', () => {
  it('fills the region, the plan and the allow list and no repository field', () => {
    const merged = postgresDefaults(every, {});

    expect(merged.config).toEqual({
      region: 'frankfurt',
      plan: 'pro-8gb',
      ipAllowList: OFFICE,
    });
    expect(merged.eligible).toEqual(['region', 'plan.postgres', 'ipAllowList']);
  });

  it('leaves the plan the database sets for itself', () => {
    expect(postgresDefaults(every, { plan: 'basic-1gb' }).config.plan).toBe('basic-1gb');
  });

  it('leaves the allow list the database sets for itself', () => {
    const merged = postgresDefaults(every, { ipAllowList: [] });

    expect(merged.config.ipAllowList).toEqual([]);
    expect(merged.applied.map((entry) => entry.key)).toEqual(['region', 'plan.postgres']);
  });
});
