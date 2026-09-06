import { describe, expect, it } from 'vitest';

import { staticSite } from '../../resources/static-site.js';
import { web } from '../../resources/web.js';
import { missingStartCommand } from './missing-start-command.js';

describe('missingStartCommand', () => {
  it('warns about a native runtime with no start command', () => {
    const warnings = missingStartCommand([web('api', { runtime: 'node' })]);

    expect(warnings).toEqual([
      {
        code: 'MissingStartCommand',
        at: { resource: 'api', field: 'startCommand' },
        message: expect.stringContaining('node'),
      },
    ]);
  });

  it('warns about nothing for a kind Render never starts', () => {
    expect(missingStartCommand([staticSite('marketing', {})])).toEqual([]);
  });

  it('warns about nothing when the start command is set', () => {
    expect(
      missingStartCommand([web('api', { runtime: 'node', startCommand: 'pnpm start' })]),
    ).toEqual([]);
  });
});
