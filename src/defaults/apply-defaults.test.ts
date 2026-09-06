import { describe, expect, it } from 'vitest';

import { DEFAULT_FIELDS, type DefaultsDeclaration } from '../resources/defaults-provenance.js';
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

const every: ScopeValues = {
  region: { value: 'frankfurt', scope },
  repo: { value: 'https://github.com/acme/mono', scope },
  branch: { value: 'main', scope },
  rootDir: { value: 'apps/api', scope },
  plan: {
    web: { value: 'standard', scope },
    privateService: { value: 'starter', scope },
    worker: { value: 'pro', scope },
    cron: { value: 'starter', scope },
    keyValue: { value: 'pro plus', scope },
    postgres: { value: 'pro-8gb', scope },
  },
};

describe('webDefaults', () => {
  it('fills the region, the plan and the repository fields a native source takes', () => {
    expect(webDefaults(every, { runtime: 'node' }).config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'standard',
      repo: 'https://github.com/acme/mono',
      branch: 'main',
      rootDir: 'apps/api',
    });
  });

  it('fills the repository fields of a Docker source', () => {
    expect(webDefaults(every, { runtime: 'docker' }).config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'standard',
      repo: 'https://github.com/acme/mono',
      branch: 'main',
      rootDir: 'apps/api',
    });
  });

  it('fills no repository field on an image source', () => {
    const merged = webDefaults(every, {
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
    }).config;

    expect(merged).toEqual({
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
      region: 'frankfurt',
      plan: 'standard',
    });
    expect(merged).not.toHaveProperty('repo');
    expect(merged).not.toHaveProperty('branch');
    expect(merged).not.toHaveProperty('rootDir');
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
      }).config,
    ).toEqual({
      runtime: 'node',
      region: 'ohio',
      plan: 'free',
      repo: 'https://github.com/acme/api',
      branch: 'release',
      rootDir: 'api',
    });
  });

  it('fills a field written as undefined, which is no value', () => {
    // @ts-expect-error exactOptionalPropertyTypes rejects this; a JavaScript caller can still write it.
    const config: WebConfig = { runtime: 'node', region: undefined };

    expect(webDefaults(every, config).config.region).toBe('frankfurt');
  });

  it('reports every default it applied, attributed to the scope that declared it', () => {
    expect(webDefaults(every, { runtime: 'node' }).applied).toEqual([
      { key: 'region', field: 'region', scope },
      { key: 'plan.web', field: 'plan', scope },
      { key: 'repo', field: 'repo', scope },
      { key: 'branch', field: 'branch', scope },
      { key: 'rootDir', field: 'rootDir', scope },
    ]);
  });

  it('reports the defaults a resource overrode as unapplied', () => {
    expect(webDefaults(every, { runtime: 'node', region: 'ohio' }).applied).not.toContainEqual({
      key: 'region',
      field: 'region',
      scope,
    });
  });

  it('reports only fields a defaults scope can fill', () => {
    const fields = webDefaults(every, { runtime: 'node' }).applied.map((entry) => entry.field);

    expect(DEFAULT_FIELDS).toEqual(expect.arrayContaining(fields));
  });
});

describe('privateServiceDefaults', () => {
  it('fills the plan its own key holds', () => {
    expect(privateServiceDefaults(every, { runtime: 'node' }).config).toMatchObject({
      plan: 'starter',
      region: 'frankfurt',
      repo: 'https://github.com/acme/mono',
    });
  });
});

describe('workerDefaults', () => {
  it('fills the plan its own key holds', () => {
    expect(workerDefaults(every, { runtime: 'node' }).config).toMatchObject({
      plan: 'pro',
      region: 'frankfurt',
      branch: 'main',
    });
  });
});

describe('cronDefaults', () => {
  it('fills the plan its own key holds', () => {
    expect(cronDefaults(every, { runtime: 'node', schedule: '0 * * * *' }).config).toMatchObject({
      plan: 'starter',
      region: 'frankfurt',
      rootDir: 'apps/api',
    });
  });
});

describe('staticSiteDefaults', () => {
  it('fills the repository fields and no region', () => {
    const merged = staticSiteDefaults(every, { buildCommand: 'pnpm build' }).config;

    expect(merged).toEqual({
      buildCommand: 'pnpm build',
      repo: 'https://github.com/acme/mono',
      branch: 'main',
      rootDir: 'apps/api',
    });
    expect(merged).not.toHaveProperty('region');
    expect(merged).not.toHaveProperty('plan');
  });
});

describe('keyValueDefaults', () => {
  it('fills the region and the plan and no repository field', () => {
    const merged = keyValueDefaults(every, { ipAllowList: [] }).config;

    expect(merged).toEqual({ ipAllowList: [], region: 'frankfurt', plan: 'pro plus' });
    expect(merged).not.toHaveProperty('repo');
    expect(merged).not.toHaveProperty('branch');
    expect(merged).not.toHaveProperty('rootDir');
  });
});

describe('postgresDefaults', () => {
  it('fills the region and the plan and no repository field', () => {
    const merged = postgresDefaults(every, {}).config;

    expect(merged).toEqual({ region: 'frankfurt', plan: 'pro-8gb' });
    expect(merged).not.toHaveProperty('repo');
    expect(merged).not.toHaveProperty('branch');
    expect(merged).not.toHaveProperty('rootDir');
  });

  it('leaves the plan the database sets for itself', () => {
    expect(postgresDefaults(every, { plan: 'basic-1gb' }).config.plan).toBe('basic-1gb');
  });
});
