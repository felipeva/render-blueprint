import { describe, expect, it } from 'vitest';

import { web } from '../../resources/web.js';
import { branchDisablesPreviews } from './branch-disables-previews.js';

describe('branchDisablesPreviews', () => {
  it('warns about a service that pins a branch while root previews are on', () => {
    const warnings = branchDisablesPreviews({ generation: 'automatic' }, [
      web('api', { runtime: 'node', branch: 'main' }),
    ]);

    expect(warnings).toEqual([
      {
        code: 'BranchDisablesPreviews',
        at: { resource: 'api', field: 'branch' },
        message: expect.stringContaining('main'),
      },
    ]);
  });

  it('warns once per service that pins a branch', () => {
    const warnings = branchDisablesPreviews({ generation: 'manual' }, [
      web('api', { runtime: 'node', branch: 'main' }),
      web('docs', { runtime: 'node' }),
      web('admin', { runtime: 'node', branch: 'release' }),
    ]);

    expect(warnings.map((warning) => warning.at.resource)).toEqual(['api', 'admin']);
  });

  it('warns about nothing when the blueprint declares no root previews', () => {
    expect(
      branchDisablesPreviews(undefined, [web('api', { runtime: 'node', branch: 'main' })]),
    ).toEqual([]);
  });

  it('warns about nothing when root preview generation is off', () => {
    expect(
      branchDisablesPreviews({ generation: 'off' }, [
        web('api', { runtime: 'node', branch: 'main' }),
      ]),
    ).toEqual([]);
  });
});
