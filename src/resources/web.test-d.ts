import { describe, expectTypeOf, it } from 'vitest';
import * as z from 'zod';

import { SERVER_PLANS, type ServerPlan } from '../enums/plan.js';
import { NATIVE_RUNTIMES, type NativeRuntime } from '../enums/runtime.js';
import type { Equal, Expect } from '../equal.js';
import { web, WEB_CONFIG_SCHEMA_MATCHES_INTERFACE, type WebService } from './web.js';

interface DriftReference {
  readonly runtime: NativeRuntime;
  readonly plan?: ServerPlan;
}

const matchingSchema = z
  .strictObject({ runtime: z.enum(NATIVE_RUNTIMES), plan: z.enum(SERVER_PLANS).exactOptional() })
  .readonly();

const gainedSchema = z
  .strictObject({
    runtime: z.enum(NATIVE_RUNTIMES),
    plan: z.enum(SERVER_PLANS).exactOptional(),
    replicas: z.number().exactOptional(),
  })
  .readonly();

const lostSchema = z.strictObject({ runtime: z.enum(NATIVE_RUNTIMES) }).readonly();

type Matching = z.infer<typeof matchingSchema>;
type Gained = z.infer<typeof gainedSchema>;
type Lost = z.infer<typeof lostSchema>;

describe('web', () => {
  it('returns a WebService', () => {
    expectTypeOf(web('api', { runtime: 'node' })).toEqualTypeOf<WebService>();
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a WebConfig field.
    web('api', { runtime: 'node', nope: true });
  });

  it('requires a runtime', () => {
    // @ts-expect-error `runtime` is the one required WebConfig field.
    web('api', {});
  });

  it('rejects a health check path without a leading slash', () => {
    // @ts-expect-error `healthCheckPath` is typed `/${string}`.
    web('api', { runtime: 'node', healthCheckPath: 'healthz' });
  });

  it('rejects a runtime outside the native set', () => {
    // @ts-expect-error `docker` is not a native runtime.
    web('api', { runtime: 'docker' });
  });

  it('rejects an explicit undefined on an optional field', () => {
    // @ts-expect-error `exactOptionalPropertyTypes` separates omitted from undefined.
    web('api', { runtime: 'node', plan: undefined });
  });
});

describe('WEB_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(WEB_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });

  it('holds when a schema and an interface declare the same fields', () => {
    expectTypeOf<Expect<Equal<Matching, DriftReference>>>().toEqualTypeOf<true>();
  });

  it('fails when the schema declares a field the interface does not', () => {
    // @ts-expect-error `replicas` is on the schema alone, so the guard is false.
    expectTypeOf<Expect<Equal<Gained, DriftReference>>>().toEqualTypeOf<true>();
  });

  it('fails when the interface declares a field the schema does not', () => {
    // @ts-expect-error `plan` is on the interface alone, so the guard is false.
    expectTypeOf<Expect<Equal<Lost, DriftReference>>>().toEqualTypeOf<true>();
  });
});
