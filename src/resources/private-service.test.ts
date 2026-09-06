import { describe, expect, it } from 'vitest';

import { external } from '../references/external.js';
import { privateService, type PrivateServiceConfig } from './private-service.js';

describe('privateService', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: PrivateServiceConfig = { runtime: 'node', startCommand: 'pnpm start' };
    const service = privateService('auth', config);

    expect(service.kind).toBe('privateService');
    expect(service.name).toBe('auth');
    expect(service.config).toBe(config);
  });

  // spec §3.1: the factory reads `privateService` and the emitted type reads `pserv`.
  it('references itself as the pserv type Render publishes', () => {
    expect(privateService('auth', { runtime: 'node' }).hostport).toEqual({
      reference: 'fromService',
      name: 'auth',
      origin: 'blueprint',
      type: 'pserv',
      property: 'hostport',
    });
  });

  it('carries the same handle form the external handle of its kind carries', () => {
    const declared = privateService('auth', { runtime: 'node' });
    const outside = external.privateService('legacy-auth');

    expect(Object.keys(outside).sort()).toEqual(
      Object.keys(declared)
        .filter((key) => key !== 'kind' && key !== 'name' && key !== 'config')
        .sort(),
    );
  });

  it('carries a prebuilt image and its workspace credential as the author wrote them', () => {
    const service = privateService('auth', {
      runtime: 'image',
      image: {
        url: 'docker.io/acme/auth:1.4.2',
        creds: external.registryCredential('acme-dockerhub'),
      },
    });

    expect(service.config).toEqual({
      runtime: 'image',
      image: {
        url: 'docker.io/acme/auth:1.4.2',
        creds: { fromRegistryCreds: { name: 'acme-dockerhub' } },
      },
    });
  });
});
