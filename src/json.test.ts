import { describe, expect, it } from 'vitest';

import { jsonObjectSchema } from './json.js';

interface Loop {
  [key: string]: Loop | undefined;
}

describe('jsonObjectSchema', () => {
  it('accepts nested objects, arrays and null', () => {
    const value = { tags: ['a', 'b'], limits: { cpu: 1, ha: true }, note: null };

    expect(jsonObjectSchema.safeParse(value).success).toBe(true);
  });

  it('accepts an empty object', () => {
    expect(jsonObjectSchema.safeParse({}).success).toBe(true);
  });

  it('accepts one object reached twice by different keys', () => {
    const shared = { cpu: 1 };

    expect(jsonObjectSchema.safeParse({ primary: shared, replica: shared }).success).toBe(true);
  });

  it('rejects a function value', () => {
    expect(jsonObjectSchema.safeParse({ build: () => 'pnpm build' }).success).toBe(false);
  });

  it('rejects an explicit undefined value', () => {
    expect(jsonObjectSchema.safeParse({ plan: undefined }).success).toBe(false);
  });

  it('rejects a Date value', () => {
    expect(jsonObjectSchema.safeParse({ deployedAt: new Date(0) }).success).toBe(false);
  });

  it('rejects a symbol value', () => {
    expect(jsonObjectSchema.safeParse({ marker: Symbol('marker') }).success).toBe(false);
  });

  it('rejects an object holding a reference back to itself', () => {
    const cyclic: Loop = {};
    cyclic['self'] = cyclic;

    expect(jsonObjectSchema.safeParse(cyclic).success).toBe(false);
  });

  it('names the path to a nested cycle', () => {
    const outer: Loop = {};
    const inner: Loop = {};
    outer['inner'] = inner;
    inner['back'] = inner;

    const result = jsonObjectSchema.safeParse(outer);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.code)).toEqual(['custom']);
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['inner', 'back']]);
  });
});
