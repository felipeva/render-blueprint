import { describe, expect, it } from 'vitest';

import type { DefaultsDeclaration } from '../resources/defaults-provenance.js';
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

const REPOSITORY = {
  repo: 'https://github.com/acme/mono',
  branch: 'main',
  rootDir: 'apps/api',
};

describe('webDefaults', () => {
  it('fills the region, the plan and the repository fields a native source takes', () => {
    expect(webDefaults(every, { runtime: 'node' }).config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'standard',
      ...REPOSITORY,
    });
  });

  it('fills the repository fields of a Docker source', () => {
    expect(webDefaults(every, { runtime: 'docker' }).config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'standard',
      ...REPOSITORY,
    });
  });

  it('fills no repository field on an image source', () => {
    expect(
      webDefaults(every, { runtime: 'image', image: { url: 'acme/api:1.4.0' } }).config,
    ).toEqual({
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
      region: 'frankfurt',
      plan: 'standard',
    });
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

  it('reports the fields it filled and no others', () => {
    expect(webDefaults(every, { runtime: 'node' }).applied.map((entry) => entry.field)).toEqual([
      'region',
      'plan',
      'repo',
      'branch',
      'rootDir',
    ]);
  });

  it('reports a default the resource overrode as eligible and not applied', () => {
    const merged = webDefaults(every, { runtime: 'node', region: 'ohio' });

    expect(merged.eligible).toEqual(['region', 'plan.web', 'repo', 'branch', 'rootDir']);
    expect(merged.applied.map((entry) => entry.key)).toEqual([
      'plan.web',
      'repo',
      'branch',
      'rootDir',
    ]);
  });

  it('reports as eligible only what an image source can take', () => {
    expect(
      webDefaults(every, { runtime: 'image', image: { url: 'acme/api:1.4.0' } }).eligible,
    ).toEqual(['region', 'plan.web']);
  });
});

describe('privateServiceDefaults', () => {
  it('fills the region, its own plan and the repository fields of a native source', () => {
    expect(privateServiceDefaults(every, { runtime: 'node' }).config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
    });
  });

  it('fills the repository fields of a Docker source', () => {
    expect(privateServiceDefaults(every, { runtime: 'docker' }).config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
    });
  });

  it('fills no repository field on an image source', () => {
    expect(
      privateServiceDefaults(every, { runtime: 'image', image: { url: 'acme/api:1.4.0' } }).config,
    ).toEqual({
      runtime: 'image',
      image: { url: 'acme/api:1.4.0' },
      region: 'frankfurt',
      plan: 'starter',
    });
  });
});

describe('workerDefaults', () => {
  it('fills the region, its own plan and the repository fields of a native source', () => {
    expect(workerDefaults(every, { runtime: 'node' }).config).toEqual({
      runtime: 'node',
      region: 'frankfurt',
      plan: 'pro',
      ...REPOSITORY,
    });
  });

  it('fills the repository fields of a Docker source', () => {
    expect(workerDefaults(every, { runtime: 'docker' }).config).toEqual({
      runtime: 'docker',
      region: 'frankfurt',
      plan: 'pro',
      ...REPOSITORY,
    });
  });

  it('fills no repository field on an image source', () => {
    expect(
      workerDefaults(every, { runtime: 'image', image: { url: 'acme/jobs:1.4.0' } }).config,
    ).toEqual({
      runtime: 'image',
      image: { url: 'acme/jobs:1.4.0' },
      region: 'frankfurt',
      plan: 'pro',
    });
  });
});

describe('cronDefaults', () => {
  it('fills the region, its own plan and the repository fields of a native source', () => {
    expect(cronDefaults(every, { runtime: 'node', schedule: '0 * * * *' }).config).toEqual({
      runtime: 'node',
      schedule: '0 * * * *',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
    });
  });

  it('fills the repository fields of a Docker source', () => {
    expect(cronDefaults(every, { runtime: 'docker', schedule: '0 * * * *' }).config).toEqual({
      runtime: 'docker',
      schedule: '0 * * * *',
      region: 'frankfurt',
      plan: 'starter',
      ...REPOSITORY,
    });
  });

  it('fills no repository field on an image source', () => {
    expect(
      cronDefaults(every, {
        runtime: 'image',
        schedule: '0 * * * *',
        image: { url: 'acme/nightly:1.4.0' },
      }).config,
    ).toEqual({
      runtime: 'image',
      schedule: '0 * * * *',
      image: { url: 'acme/nightly:1.4.0' },
      region: 'frankfurt',
      plan: 'starter',
    });
  });
});

describe('staticSiteDefaults', () => {
  it('fills the repository fields and neither a region nor a plan', () => {
    const merged = staticSiteDefaults(every, { buildCommand: 'pnpm build' });

    expect(merged.config).toEqual({ buildCommand: 'pnpm build', ...REPOSITORY });
    expect(merged.eligible).toEqual(['repo', 'branch', 'rootDir']);
  });
});

describe('keyValueDefaults', () => {
  it('fills the region and the plan and no repository field', () => {
    const merged = keyValueDefaults(every, { ipAllowList: [] });

    expect(merged.config).toEqual({ ipAllowList: [], region: 'frankfurt', plan: 'pro plus' });
    expect(merged.eligible).toEqual(['region', 'plan.keyValue']);
  });
});

describe('postgresDefaults', () => {
  it('fills the region and the plan and no repository field', () => {
    const merged = postgresDefaults(every, {});

    expect(merged.config).toEqual({ region: 'frankfurt', plan: 'pro-8gb' });
    expect(merged.eligible).toEqual(['region', 'plan.postgres']);
  });

  it('leaves the plan the database sets for itself', () => {
    expect(postgresDefaults(every, { plan: 'basic-1gb' }).config.plan).toBe('basic-1gb');
  });
});
