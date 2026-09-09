import { describe, expect, it } from 'vitest';

import { raisedIssuesThrough, type RaisedIssue } from '../../test/support/raised-issues.js';
import { external } from '../references/external.js';
import {
  parsePrivateServiceConfig,
  privateService,
  type PrivateServiceConfig,
} from './private-service.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => PrivateServiceConfig = JSON.parse;

const raisedIssues: (config: PrivateServiceConfig) => readonly RaisedIssue[] =
  raisedIssuesThrough(parsePrivateServiceConfig);

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

describe('parsePrivateServiceConfig', () => {
  it('reports a disk beside more than one instance when the plan did not parse', () => {
    expect(
      raisedIssues(
        unchecked(
          '{"runtime":"node","plan":"mars","disk":{"name":"keys","mountPath":"/var/keys"},"instances":3}',
        ),
      ),
    ).toEqual([{ validationCode: 'DiskPreventsScaling', path: ['instances'] }]);
  });
});
