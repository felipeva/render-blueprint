import { describe, expect, it } from 'vitest';

import { withDefaults } from '../../defaults/with-defaults.js';
import { cron } from '../../resources/cron.js';
import { envGroup } from '../../resources/env-group.js';
import { keyValue } from '../../resources/key-value.js';
import { postgres } from '../../resources/postgres.js';
import { privateService } from '../../resources/private-service.js';
import type { ServiceImage } from '../../resources/service-source.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { autoDeployTriggerOnImageSource } from './auto-deploy-trigger-on-image-source.js';

const IMAGE: ServiceImage = { url: 'docker.io/acme/api:1.0.0' };

describe('autoDeployTriggerOnImageSource', () => {
  it('warns about a trigger on an image-sourced web service, naming the resource and the field', () => {
    const warnings = autoDeployTriggerOnImageSource([
      web('api', { runtime: 'image', image: IMAGE, autoDeployTrigger: 'checksPass' }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'AutoDeployTriggerOnImageSource',
        at: { resource: 'api', field: 'autoDeployTrigger' },
        message:
          '"api" runs a prebuilt image and writes the autoDeployTrigger "checksPass". Render documents the field as having no effect for a service that deploys a prebuilt Docker image, so the value names no deploy policy a sync applies.',
      },
    ]);
  });

  it('warns about every kind an image can source', () => {
    const warnings = autoDeployTriggerOnImageSource([
      web('api', { runtime: 'image', image: IMAGE, autoDeployTrigger: 'commit' }),
      privateService('auth', { runtime: 'image', image: IMAGE, autoDeployTrigger: 'commit' }),
      worker('jobs', { runtime: 'image', image: IMAGE, autoDeployTrigger: 'off' }),
      cron('nightly', {
        runtime: 'image',
        image: IMAGE,
        schedule: '0 2 * * *',
        autoDeployTrigger: 'checksPass',
      }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'api', field: 'autoDeployTrigger' },
      { resource: 'auth', field: 'autoDeployTrigger' },
      { resource: 'jobs', field: 'autoDeployTrigger' },
      { resource: 'nightly', field: 'autoDeployTrigger' },
    ]);
  });

  it('warns about nothing when the source is a native runtime or a Dockerfile', () => {
    expect(
      autoDeployTriggerOnImageSource([
        web('api', { runtime: 'node', autoDeployTrigger: 'checksPass' }),
        privateService('auth', { runtime: 'docker', autoDeployTrigger: 'commit' }),
        worker('jobs', { runtime: 'docker', autoDeployTrigger: 'off' }),
        cron('nightly', { runtime: 'node', schedule: '0 2 * * *', autoDeployTrigger: 'commit' }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing when an image source writes no trigger', () => {
    expect(
      autoDeployTriggerOnImageSource([
        web('api', { runtime: 'image', image: IMAGE }),
        privateService('auth', { runtime: 'image', image: IMAGE }),
        worker('jobs', { runtime: 'image', image: IMAGE }),
        cron('nightly', { runtime: 'image', image: IMAGE, schedule: '0 2 * * *' }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a static site, which has no image source to set one on', () => {
    expect(
      autoDeployTriggerOnImageSource([staticSite('site', { autoDeployTrigger: 'checksPass' })]),
    ).toEqual([]);
  });

  it('warns about nothing for the kinds that carry no trigger at all', () => {
    expect(
      autoDeployTriggerOnImageSource([
        keyValue('cache', { ipAllowList: [{ source: '203.0.113.4/30' }] }),
        postgres('db'),
        envGroup('shared', { env: { LOG_LEVEL: 'info' } }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a scope trigger, which an image-sourced service never takes', () => {
    const scope = withDefaults({ autoDeployTrigger: 'checksPass' });

    expect(
      autoDeployTriggerOnImageSource([
        scope.web('api', { runtime: 'image', image: IMAGE }),
        scope.privateService('auth', { runtime: 'image', image: IMAGE }),
        scope.worker('jobs', { runtime: 'image', image: IMAGE }),
        scope.cron('nightly', { runtime: 'image', image: IMAGE, schedule: '0 2 * * *' }),
      ]),
    ).toEqual([]);
  });
});
