import { describe, expect, it } from 'vitest';

import { staticSite, type StaticSiteConfig } from './static-site.js';

describe('staticSite', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: StaticSiteConfig = {
      buildCommand: 'pnpm build',
      staticPublishPath: './dist',
    };

    expect(staticSite('marketing', config)).toEqual({
      kind: 'staticSite',
      name: 'marketing',
      config,
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
