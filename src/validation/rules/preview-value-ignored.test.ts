import { describe, expect, it } from 'vitest';

import { literal } from '../../env/literal.js';
import { cron } from '../../resources/cron.js';
import { envGroup } from '../../resources/env-group.js';
import { privateService } from '../../resources/private-service.js';
import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { worker } from '../../resources/worker.js';
import { previewValueIgnored } from './preview-value-ignored.js';

describe('previewValueIgnored', () => {
  it('warns about a previewValue on a worker, naming the resource and the variable', () => {
    const warnings = previewValueIgnored([
      worker('jobs', {
        runtime: 'node',
        env: {
          API_BASE_URL: literal('https://api.example.com', { previewValue: 'http://localhost' }),
        },
      }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'PreviewValueIgnored',
        at: { resource: 'jobs', field: 'env.API_BASE_URL' },
        message:
          '"jobs" writes a previewValue on the environment variable "API_BASE_URL". Render supports the override for web services, private services and environment groups, so a worker never reads it; set the value on the service the preview reads, or move the variable to an environment group.',
      },
    ]);
  });

  it('warns about a previewValue on a cron job', () => {
    const warnings = previewValueIgnored([
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) },
      }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'PreviewValueIgnored',
        at: { resource: 'nightly', field: 'env.LOG_LEVEL' },
        message:
          '"nightly" writes a previewValue on the environment variable "LOG_LEVEL". Render supports the override for web services, private services and environment groups, so a cron job never reads it; set the value on the service the preview reads, or move the variable to an environment group.',
      },
    ]);
  });

  it('warns about a previewValue the callback env form declares', () => {
    const warnings = previewValueIgnored([
      worker('jobs', {
        runtime: 'node',
        env: (self) => ({
          SELF_ID: self.renderVar('RENDER_SERVICE_ID'),
          LOG_LEVEL: literal('info', { previewValue: 'debug' }),
        }),
      }),
      cron('nightly', {
        runtime: 'node',
        schedule: '0 2 * * *',
        env: () => ({ LOG_LEVEL: literal('info', { previewValue: 'debug' }) }),
      }),
    ]);

    expect(warnings.map((warning) => warning.at)).toEqual([
      { resource: 'jobs', field: 'env.LOG_LEVEL' },
      { resource: 'nightly', field: 'env.LOG_LEVEL' },
    ]);
  });

  it('warns about nothing for a web service or a private service, which Render documents it for', () => {
    expect(
      previewValueIgnored([
        web('api', {
          runtime: 'node',
          env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) },
        }),
        privateService('auth', {
          runtime: 'node',
          env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) },
        }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a static site or an environment group', () => {
    expect(
      previewValueIgnored([
        staticSite('site', { env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) } }),
        envGroup('shared', { env: { LOG_LEVEL: literal('info', { previewValue: 'debug' }) } }),
      ]),
    ).toEqual([]);
  });

  it('warns about nothing for a literal or a plain value that writes no previewValue', () => {
    expect(
      previewValueIgnored([
        worker('jobs', { runtime: 'node', env: { LOG_LEVEL: literal('info') } }),
        cron('nightly', { runtime: 'node', schedule: '0 2 * * *', env: { LOG_LEVEL: 'info' } }),
      ]),
    ).toEqual([]);
  });

  it('warns about every entry, never the first only', () => {
    const warnings = previewValueIgnored([
      worker('jobs', {
        runtime: 'node',
        env: {
          LOG_LEVEL: literal('info', { previewValue: 'debug' }),
          API_BASE_URL: literal('https://api.example.com', { previewValue: 'http://localhost' }),
        },
      }),
    ]);

    expect(warnings.map((warning) => warning.at.field)).toEqual([
      'env.LOG_LEVEL',
      'env.API_BASE_URL',
    ]);
  });
});
