import { describe, expect, it } from 'vitest';

import { staticSite, type StaticSiteConfig } from './static-site.js';

describe('staticSite', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: StaticSiteConfig = {
      buildCommand: 'pnpm build',
      staticPublishPath: './dist',
    };

    const site = staticSite('marketing', config);

    expect(site.kind).toBe('staticSite');
    expect(site.name).toBe('marketing');
    expect(site.config).toBe(config);
  });

  it('answers fromService with the type Render reserves for a static site', () => {
    expect(staticSite('marketing', {}).envVar('BUILD_ID')).toEqual({
      reference: 'fromService',
      name: 'marketing',
      origin: 'blueprint',
      type: 'static',
      envVarKey: 'BUILD_ID',
    });
  });

  it('emits the name verbatim', () => {
    expect(staticSite('Marketing Site', {}).name).toBe('Marketing Site');
  });

  it('carries the routes and the headers the author wrote, in order', () => {
    const site = staticSite('marketing', {
      routes: [
        { type: 'redirect', source: '/old', destination: '/new' },
        { type: 'rewrite', source: '/*', destination: '/index.html' },
      ],
      headers: [{ path: '/*', name: 'X-Frame-Options', value: 'DENY' }],
    });

    expect(site.config.routes?.map((route) => route.type)).toEqual(['redirect', 'rewrite']);
    expect(site.config.headers?.[0]?.name).toBe('X-Frame-Options');
  });
});
