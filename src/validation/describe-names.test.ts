import { describe, expect, it } from 'vitest';

import { describeNames } from './describe-names.js';

describe('describeNames', () => {
  it('quotes one name', () => {
    expect(describeNames(['a'])).toBe('"a"');
  });

  it('joins two names with and', () => {
    expect(describeNames(['a', 'b'])).toBe('"a" and "b"');
  });

  it('separates three names with commas and joins the last with and', () => {
    expect(describeNames(['a', 'b', 'c'])).toBe('"a", "b" and "c"');
  });
});
