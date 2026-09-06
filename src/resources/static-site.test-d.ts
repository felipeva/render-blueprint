import { describe, expectTypeOf, it } from 'vitest';

import {
  staticSite,
  STATIC_SITE_CONFIG_SCHEMA_MATCHES_INTERFACE,
  type StaticSite,
} from './static-site.js';

describe('staticSite', () => {
  it('returns a StaticSite', () => {
    expectTypeOf(staticSite('marketing', {})).toEqualTypeOf<StaticSite>();
  });

  it('rejects a compute plan', () => {
    // @ts-expect-error a static site has no plan; Render gives it no compute.
    staticSite('marketing', { plan: 'starter' });
  });

  it('rejects a region', () => {
    // @ts-expect-error region does not apply to a static site.
    staticSite('marketing', { region: 'oregon' });
  });

  it('rejects a start command', () => {
    // @ts-expect-error a static site is served, never started.
    staticSite('marketing', { startCommand: 'pnpm start' });
  });

  it('rejects a disk', () => {
    // @ts-expect-error a static site has no disk.
    staticSite('marketing', { disk: { name: 'data', mountPath: '/data' } });
  });

  it('rejects a runtime', () => {
    // @ts-expect-error synth writes runtime: static; the config never names it.
    staticSite('marketing', { runtime: 'static' });
  });

  it('rejects a config field Render does not define', () => {
    // @ts-expect-error `nope` is not a StaticSiteConfig field.
    staticSite('marketing', { nope: true });
  });

  it('rejects a route type outside the published pair', () => {
    // @ts-expect-error `proxy` is not a route type.
    staticSite('marketing', { routes: [{ type: 'proxy', source: '/*', destination: '/' }] });
  });

  it('rejects a header without a value', () => {
    // @ts-expect-error a header carries a path, a name, and a value.
    staticSite('marketing', { headers: [{ path: '/*', name: 'X-Frame-Options' }] });
  });

  it('rejects an explicit undefined on an optional field', () => {
    // @ts-expect-error `exactOptionalPropertyTypes` separates omitted from undefined.
    staticSite('marketing', { branch: undefined });
  });
});

describe('STATIC_SITE_CONFIG_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(STATIC_SITE_CONFIG_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
