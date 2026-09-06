import { describe, expectTypeOf, it } from 'vitest';

import { cron } from '../resources/cron.js';
import { envGroup } from '../resources/env-group.js';
import { keyValue } from '../resources/key-value.js';
import { postgres } from '../resources/postgres.js';
import { privateService } from '../resources/private-service.js';
import { staticSite } from '../resources/static-site.js';
import type { WebService } from '../resources/web.js';
import { web } from '../resources/web.js';
import { worker } from '../resources/worker.js';
import { RECORD_KEYS_COVER_THE_DEFAULT_KEYS } from './resource-defaults.js';
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
