import { describe, expect, it } from 'vitest';

import { registryCredentialReference } from './registry-credential-reference.js';

describe('registryCredentialReference', () => {
  it('names the credential the workspace holds, in the form Render reads it', () => {
    expect(registryCredentialReference('acme-dockerhub')).toEqual({
      fromRegistryCreds: { name: 'acme-dockerhub' },
    });
  });
});
