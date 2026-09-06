import { describe, expect, it } from 'vitest';

import { web, type WebConfig } from './web.js';

describe('web', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: WebConfig = { runtime: 'node', buildCommand: 'pnpm build' };
    const service = web('api', config);

    expect(service.kind).toBe('web');
    expect(service.name).toBe('api');
    expect(service.config).toBe(config);
  });

  it('emits the name verbatim', () => {
    expect(web('Legacy API', { runtime: 'go' }).name).toBe('Legacy API');
  });

  it('exposes a handle that references its own name', () => {
    expect(web('api', { runtime: 'node' }).hostport).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      property: 'hostport',
    });
  });

  it('aliases a variable Render provides on itself', () => {
    expect(web('api', { runtime: 'node' }).renderVar('RENDER_EXTERNAL_HOSTNAME')).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      envVarKey: 'RENDER_EXTERNAL_HOSTNAME',
    });
  });

  it('resolves the callback form of env against its own handle', () => {
    const service = web('api', {
      runtime: 'node',
      env: (self) => ({ APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME') }),
    });

    expect(service.config.env).toBeTypeOf('function');
    expect(service.hostport.name).toBe('api');
  });
});
