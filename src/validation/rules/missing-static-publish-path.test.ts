import { describe, expect, it } from 'vitest';

import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { missingStaticPublishPath } from './missing-static-publish-path.js';

describe('missingStaticPublishPath', () => {
  it('warns about a static site with no publish path', () => {
    const warnings = missingStaticPublishPath([staticSite('marketing', {})]);

    expect(warnings).toEqual([
      {
        code: 'MissingStaticPublishPath',
        at: { resource: 'marketing', field: 'staticPublishPath' },
        message: expect.stringContaining('staticPublishPath'),
      },
    ]);
  });

  it('warns about nothing when the publish path is set', () => {
    expect(
      missingStaticPublishPath([staticSite('marketing', { staticPublishPath: './dist' })]),
    ).toEqual([]);
  });

  it('warns about nothing for a kind that publishes no directory', () => {
    expect(missingStaticPublishPath([web('api', { runtime: 'node' })])).toEqual([]);
  });
});
