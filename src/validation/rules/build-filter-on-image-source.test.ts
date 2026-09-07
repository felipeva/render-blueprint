import { describe, expect, it } from 'vitest';

import type { BuildFilter } from '../../resources/build-filter.js';
import { cron } from '../../resources/cron.js';
import { privateService } from '../../resources/private-service.js';
import type { ServiceImage } from '../../resources/service-source.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { buildFilterOnImageSource } from './build-filter-on-image-source.js';

const FILTER: BuildFilter = { paths: ['src/**'] };
const IMAGE: ServiceImage = { url: 'docker.io/acme/api:1.0.0' };

describe('buildFilterOnImageSource', () => {
  it('warns about a build filter on an image-sourced web service', () => {
    const warnings = buildFilterOnImageSource([
      web('api', { runtime: 'image', image: IMAGE, buildFilter: FILTER }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'BuildFilterOnImageSource',
        at: { resource: 'api', field: 'buildFilter' },
        message: expect.stringContaining('prebuilt image'),
      },
    ]);
  });

  it('warns about every kind an image can source', () => {
    const warnings = buildFilterOnImageSource([
      web('api', { runtime: 'image', image: IMAGE, buildFilter: FILTER }),
      privateService('auth', { runtime: 'image', image: IMAGE, buildFilter: FILTER }),
      worker('jobs', { runtime: 'image', image: IMAGE, buildFilter: FILTER }),
      cron('nightly', {
        runtime: 'image',
        image: IMAGE,
        schedule: '0 2 * * *',
        buildFilter: FILTER,
      }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual([
      'api',
      'auth',
      'jobs',
      'nightly',
    ]);
  });

  it('warns about nothing when the source is a repository', () => {
    expect(
      buildFilterOnImageSource([
        web('api', { runtime: 'node', buildFilter: FILTER }),
        worker('jobs', { runtime: 'docker', buildFilter: FILTER }),
        cron('nightly', { runtime: 'node', schedule: '0 2 * * *', buildFilter: FILTER }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when an image source sets no build filter', () => {
    expect(
      buildFilterOnImageSource([
        web('api', { runtime: 'image', image: IMAGE }),
        privateService('auth', { runtime: 'image', image: IMAGE }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a kind that has no image source to set one on', () => {
    expect(buildFilterOnImageSource([staticSite('site', { buildFilter: FILTER })])).toEqual([]);
  });
});
