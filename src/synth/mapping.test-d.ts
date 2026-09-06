import { describe, it } from 'vitest';

import { mapping } from './mapping.js';

const ORDER = ['type', 'name'] as const;

describe('mapping', () => {
  it('rejects a value the order does not list', () => {
    // @ts-expect-error `nope` is not a key of the order.
    mapping(ORDER, { type: 'web', name: 'api', nope: 1 }, undefined);
  });

  it('requires a value for every key the order lists', () => {
    // @ts-expect-error `name` is missing.
    mapping(ORDER, { type: 'web' }, undefined);
  });
});
