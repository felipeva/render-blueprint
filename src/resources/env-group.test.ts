import { describe, expect, it } from 'vitest';

import { generated } from '../env/generated.js';
import { envGroup, type EnvGroupConfig } from './env-group.js';

describe('envGroup', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: EnvGroupConfig = { env: { LOG_LEVEL: 'info' } };

    expect(envGroup('shared-settings', config)).toEqual({
      kind: 'envGroup',
      name: 'shared-settings',
      config,
    });
  });

  it('emits the name verbatim', () => {
    expect(envGroup('Shared Settings', { env: {} }).name).toBe('Shared Settings');
  });

  it('keeps the sentinel a value declares, rather than resolving it', () => {
    expect(
      envGroup('shared-settings', { env: { SESSION_SECRET: generated() } }).config.env,
    ).toEqual({ SESSION_SECRET: { sentinel: 'generated' } });
  });
});
