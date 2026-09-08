import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { parseStaticSiteConfig, staticSite, type StaticSiteConfig } from './static-site.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => StaticSiteConfig = JSON.parse;

const issueCodes = (config: StaticSiteConfig): readonly string[] => {
  const result = parseStaticSiteConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

const raisedIssues: (config: StaticSiteConfig) => readonly RaisedIssue[] =
  raisedIssuesThrough(parseStaticSiteConfig);

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

describe('parseStaticSiteConfig', () => {
  it('accepts an ipAllowList in the entry form every kind that takes one shares', () => {
    expect(
      issueCodes({
        ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }, { source: '::1' }],
      }),
    ).toEqual([]);
  });

  it('accepts an empty ipAllowList, which blocks every external connection', () => {
    expect(issueCodes({ ipAllowList: [] })).toEqual([]);
  });

  it('rejects a field the library does not model on an ipAllowList entry', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[{"source":"::1","label":"all"}]}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('rejects an ipAllowList entry with no source', () => {
    expect(issueCodes(unchecked('{"ipAllowList":[{"description":"office"}]}'))).toEqual([
      'invalid_type',
    ]);
  });

  it('accepts a subdomain policy beside the domains it leaves as the only address', () => {
    expect(issueCodes({ domains: ['acme.dev'], renderSubdomainPolicy: 'disabled' })).toEqual([]);
  });

  it('rejects a subdomain policy Render does not publish', () => {
    expect(issueCodes(unchecked('{"renderSubdomainPolicy":"off"}'))).toEqual(['invalid_value']);
  });

  it('reports a disabled subdomain policy on a site that lists no domain', () => {
    expect(raisedIssues({ renderSubdomainPolicy: 'disabled' })).toEqual([
      { validationCode: 'SubdomainPolicyNeedsDomain', path: ['renderSubdomainPolicy'] },
    ]);
  });

  it('accepts an enabled subdomain policy on a site that lists no domain', () => {
    expect(issueCodes({ renderSubdomainPolicy: 'enabled' })).toEqual([]);
  });
});
