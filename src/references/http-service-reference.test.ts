import { describe, expect, it } from 'vitest';

import { httpServiceReference } from './http-service-reference.js';

const api = httpServiceReference({ name: 'api', type: 'web', origin: 'blueprint' });

describe('httpServiceReference', () => {
  it('names the target, the origin and the type on every property it carries', () => {
    expect([api.host, api.port, api.hostport]).toEqual([
      { reference: 'fromService', name: 'api', origin: 'blueprint', type: 'web', property: 'host' },
      { reference: 'fromService', name: 'api', origin: 'blueprint', type: 'web', property: 'port' },
      {
        reference: 'fromService',
        name: 'api',
        origin: 'blueprint',
        type: 'web',
        property: 'hostport',
      },
    ]);
  });

  it('reads another service variable by key', () => {
    expect(api.envVar('MINIO_ROOT_PASSWORD')).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      envVarKey: 'MINIO_ROOT_PASSWORD',
    });
  });

  it('reads a variable Render provides through the same envVarKey form', () => {
    expect(api.renderVar('RENDER_EXTERNAL_HOSTNAME')).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      envVarKey: 'RENDER_EXTERNAL_HOSTNAME',
    });
  });

  it('carries the type it was built with, which a private service shares', () => {
    expect(
      httpServiceReference({ name: 'legacy-auth', type: 'pserv', origin: 'blueprint' }).host.type,
    ).toBe('pserv');
  });
});
