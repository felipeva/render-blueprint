import { describe, expect, it } from 'vitest';

import { renderSchema } from './render-schema.js';

describe('renderSchema', () => {
  it("rejects a document Render's JSON Schema forbids", () => {
    const violations = renderSchema({
      services: [{ type: 'web', name: 'api', runtime: 'node', notARenderField: true }],
    });

    expect(violations).not.toEqual([]);
  });
});
