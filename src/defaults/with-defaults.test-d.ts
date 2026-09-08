import { describe, expectTypeOf, it } from 'vitest';

import type {
  CronPlan,
  KeyValuePlan,
  PaidServerPlan,
  PostgresPlan,
  ServerPlan,
} from '../enums/plan.js';
import { cron } from '../resources/cron.js';
import { envGroup } from '../resources/env-group.js';
import { keyValue } from '../resources/key-value.js';
import { postgres } from '../resources/postgres.js';
import { privateService } from '../resources/private-service.js';
import { staticSite } from '../resources/static-site.js';
import type { WebService } from '../resources/web.js';
import { web } from '../resources/web.js';
import { worker } from '../resources/worker.js';
import type { PlanDefaults, ResourceDefaults } from './resource-defaults.js';
import {
  DEFAULT_FIELDS_COVER_THE_RECORD_KEYS,
  PLAN_KINDS_COVER_THE_PLAN_DEFAULTS,
  RECORD_KEYS_COVER_THE_DEFAULT_KEYS,
} from './resource-defaults.js';
import { withDefaults } from './with-defaults.js';

const scope = withDefaults({ region: 'oregon' });

describe('withDefaults', () => {
  it('returns every factory with the signature the bare one has', () => {
    expectTypeOf(scope.web).toEqualTypeOf<typeof web>();
    expectTypeOf(scope.privateService).toEqualTypeOf<typeof privateService>();
    expectTypeOf(scope.worker).toEqualTypeOf<typeof worker>();
    expectTypeOf(scope.cron).toEqualTypeOf<typeof cron>();
    expectTypeOf(scope.staticSite).toEqualTypeOf<typeof staticSite>();
    expectTypeOf(scope.keyValue).toEqualTypeOf<typeof keyValue>();
    expectTypeOf(scope.postgres).toEqualTypeOf<typeof postgres>();
    expectTypeOf(scope.envGroup).toEqualTypeOf<typeof envGroup>();
  });

  it('returns a scope that nests', () => {
    expectTypeOf(scope.withDefaults({ branch: 'main' }).web).toEqualTypeOf<typeof web>();
  });

  it('returns the resource value the bare factory returns', () => {
    expectTypeOf(scope.web('api', { runtime: 'node' })).toEqualTypeOf<WebService>();
  });

  it('holds the record keys the provenance names', () => {
    expectTypeOf(RECORD_KEYS_COVER_THE_DEFAULT_KEYS).toEqualTypeOf<true>();
  });

  it('holds the plan kinds the plan record names', () => {
    expectTypeOf(PLAN_KINDS_COVER_THE_PLAN_DEFAULTS).toEqualTypeOf<true>();
  });

  it('holds the fields a default lands in equal to the record keys', () => {
    expectTypeOf(DEFAULT_FIELDS_COVER_THE_RECORD_KEYS).toEqualTypeOf<true>();
  });

  it('rejects a default the record does not model', () => {
    // @ts-expect-error `diskSizeGB` is not a ResourceDefaults field.
    withDefaults({ diskSizeGB: 10 });
  });

  it('rejects a region Render does not publish', () => {
    // @ts-expect-error `dublin` is not a member of Region.
    withDefaults({ region: 'dublin' });
  });

  it('rejects a plan given outside the per-kind record', () => {
    // @ts-expect-error a plan default is one key per kind, never a bare plan.
    withDefaults({ plan: 'starter' });
  });

  it('rejects a plan key for a kind that has no plan', () => {
    // @ts-expect-error a static site has no plan, so PlanDefaults has no `staticSite` key.
    withDefaults({ plan: { staticSite: 'free' } });
  });

  it('rejects a plan key for a kind that takes no default', () => {
    // @ts-expect-error an environment group takes no default, so PlanDefaults has no key for it.
    withDefaults({ plan: { envGroup: 'free' } });
  });

  it('rejects a plan from another kind on the web key', () => {
    // @ts-expect-error `pro-8gb` is a Postgres plan, not a ServerPlan.
    withDefaults({ plan: { web: 'pro-8gb' } });
  });

  it('rejects the free plan on the kinds Render bills', () => {
    // @ts-expect-error `free` is not a member of PaidServerPlan.
    withDefaults({ plan: { worker: 'free' } });
    // @ts-expect-error `free` is not a member of PaidServerPlan.
    withDefaults({ plan: { privateService: 'free' } });
  });

  it('rejects a plan a cron job cannot run on', () => {
    // @ts-expect-error `pro max` is not a member of CronPlan.
    withDefaults({ plan: { cron: 'pro max' } });
  });

  it('rejects a plan a Key Value instance does not take', () => {
    // @ts-expect-error `basic-1gb` is a Postgres plan, not a KeyValuePlan.
    withDefaults({ plan: { keyValue: 'basic-1gb' } });
  });

  it('accepts every plan key its own kind publishes', () => {
    expectTypeOf(
      withDefaults({
        plan: {
          web: 'free',
          privateService: 'starter',
          worker: 'standard',
          cron: '2c-4g',
          keyValue: '256mb',
          postgres: 'accelerated-16gb',
        },
      }),
    ).toEqualTypeOf<typeof scope>();
  });

  it('accepts the build filter, the deploy trigger and the allow list', () => {
    expectTypeOf(
      withDefaults({
        autoDeployTrigger: 'checksPass',
        buildFilter: { paths: ['apps/**'], ignoredPaths: ['docs/**'] },
        ipAllowList: [{ source: '203.0.113.0/24', description: 'office' }],
      }),
    ).toEqualTypeOf<typeof scope>();
  });

  it('rejects a deploy trigger Render does not publish', () => {
    // @ts-expect-error `onPush` is not a member of AutoDeployTrigger.
    withDefaults({ autoDeployTrigger: 'onPush' });
  });

  it('rejects a build filter key the schema does not carry', () => {
    // @ts-expect-error a BuildFilter carries paths and ignoredPaths and nothing else.
    withDefaults({ buildFilter: { include: ['apps/**'] } });
    // @ts-expect-error a path list is a list of strings.
    withDefaults({ buildFilter: { paths: 'apps/**' } });
  });

  it('rejects an allow list entry the schema does not carry', () => {
    // @ts-expect-error an entry names its `source`.
    withDefaults({ ipAllowList: [{ cidr: '203.0.113.0/24' }] });
    // @ts-expect-error an allow list is a list of entries, not one entry.
    withDefaults({ ipAllowList: { source: '203.0.113.0/24' } });
  });

  it('keeps the plan record the one place a plan default is written', () => {
    expectTypeOf<ResourceDefaults['plan']>().toEqualTypeOf<PlanDefaults | undefined>();
    expectTypeOf<PlanDefaults>().toEqualTypeOf<{
      readonly web?: ServerPlan;
      readonly privateService?: PaidServerPlan;
      readonly worker?: PaidServerPlan;
      readonly cron?: CronPlan;
      readonly keyValue?: KeyValuePlan;
      readonly postgres?: PostgresPlan;
    }>();
  });

  it('takes a build filter and a deploy trigger beside an image-sourced resource', () => {
    expectTypeOf(
      withDefaults({
        autoDeployTrigger: 'checksPass',
        buildFilter: { paths: ['apps/**'] },
      }).worker('jobs', { runtime: 'image', image: { url: 'acme/jobs:1.4.0' } }),
    ).toEqualTypeOf<ReturnType<typeof worker>>();
  });

  it('rejects an allow list on the kinds whose config lacks the field', () => {
    const allowed = withDefaults({ ipAllowList: [{ source: '203.0.113.0/24' }] });

    // @ts-expect-error a WorkerConfig has no ipAllowList, through a scope as without one.
    allowed.worker('jobs', { runtime: 'node', ipAllowList: [] });
    // @ts-expect-error a CronConfig has no ipAllowList, through a scope as without one.
    allowed.cron('nightly', { runtime: 'node', schedule: '0 3 * * *', ipAllowList: [] });
  });

  it('takes a repository default beside an image-sourced resource', () => {
    expectTypeOf(
      withDefaults({ repo: 'https://github.com/acme/mono' }).worker('jobs', {
        runtime: 'image',
        image: { url: 'acme/jobs:1.4.0' },
      }),
    ).toEqualTypeOf<ReturnType<typeof worker>>();
  });

  it('rejects on a static site the fields a static site does not model', () => {
    // @ts-expect-error a StaticSiteConfig has no region, through a scope as without one.
    scope.staticSite('site', { region: 'oregon' });
    // @ts-expect-error a StaticSiteConfig has no plan, through a scope as without one.
    scope.staticSite('site', { plan: 'free' });
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a WebConfig field, through a scope as without one.
    scope.web('api', { runtime: 'node', nope: true });
  });

  it('rejects a config that mixes two source branches', () => {
    // @ts-expect-error a native source builds a repository and names no prebuilt image.
    scope.web('api', { runtime: 'node', image: { url: 'acme/api:1.4.0' } });
    // @ts-expect-error an image source names no repository, whatever the scope defaults to.
    scope.worker('jobs', { runtime: 'image', image: { url: 'acme/jobs:1' }, repo: 'r' });
  });

  it('keeps every field the bare factory requires required', () => {
    // @ts-expect-error a service config picks its source with `runtime`.
    scope.web('api', {});
    // @ts-expect-error `ipAllowList` is the one required KeyValueConfig field.
    scope.keyValue('cache', {});
    // @ts-expect-error a cron job runs on a `schedule`.
    scope.cron('nightly', { runtime: 'node' });
  });

  it('keeps the config of a database optional', () => {
    expectTypeOf(scope.postgres('records')).toEqualTypeOf<ReturnType<typeof postgres>>();
  });
});
