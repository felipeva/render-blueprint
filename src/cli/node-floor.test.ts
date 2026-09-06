import { describe, expect, it } from 'vitest';

import { belowNodeFloor, NODE_FLOOR } from './node-floor.js';

describe('belowNodeFloor', () => {
  it('accepts the floor itself', () => {
    expect(belowNodeFloor(NODE_FLOOR)).toBe(false);
  });

  it('accepts every version above the floor', () => {
    for (const version of ['22.18.1', '22.19.0', '23.0.0', '24.13.0', '26.1.2']) {
      expect(belowNodeFloor(version)).toBe(false);
    }
  });

  it('refuses every version below the floor', () => {
    for (const version of ['22.17.9', '22.6.0', '22.0.0', '21.7.3', '20.19.0']) {
      expect(belowNodeFloor(version)).toBe(true);
    }
  });

  it('reads a leading v', () => {
    expect(belowNodeFloor('v20.19.0')).toBe(true);
    expect(belowNodeFloor('v24.13.0')).toBe(false);
  });

  it('lets a version it cannot read through rather than blocking the run', () => {
    expect(belowNodeFloor('unreleased')).toBe(false);
  });
});
