import { describe, expect, it } from 'vitest';

import { renderSchema } from './render-schema.js';

describe('renderSchema', () => {
  it("rejects a document Render's JSON Schema forbids", () => {
    const violations = renderSchema({
      services: [{ type: 'web', name: 'api', runtime: 'node', notARenderField: true }],
    });

    expect(violations).not.toEqual([]);
  });

  it('rejects the retired afterFirstDeployCommand alias on a server service', () => {
    const violations = renderSchema({
      services: [
        { type: 'web', name: 'api', runtime: 'node', afterFirstDeployCommand: './seed.sh' },
      ],
    });

    expect(violations).not.toEqual([]);
  });

  it('rejects a maintenance mode uri that is not a URI', () => {
    const violations = renderSchema({
      services: [
        {
          type: 'web',
          name: 'api',
          runtime: 'node',
          maintenanceMode: { enabled: true, uri: 'not a url at all' },
        },
      ],
    });

    expect(violations.map((violation) => violation.at)).toContain(
      '/services/0/maintenanceMode/uri',
    );
  });
});
