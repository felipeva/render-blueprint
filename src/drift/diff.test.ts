import { describe, expect, it } from 'vitest';

import { diff } from './diff.js';

describe('diff', () => {
  it('returns an empty string for two identical texts', () => {
    expect(diff(['a', 'b'], ['a', 'b'])).toBe('');
  });

  it('marks a line only in the committed text with a minus', () => {
    expect(diff(['a', 'b'], ['a'])).toBe('@@ -1,2 +1,1 @@\n a\n-b');
  });

  it('marks a line only in the generated text with a plus', () => {
    expect(diff(['a'], ['a', 'b'])).toBe('@@ -1,1 +1,2 @@\n a\n+b');
  });

  it('pairs a replaced line as a removal followed by an addition', () => {
    expect(diff(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe('@@ -1,3 +1,3 @@\n a\n-b\n+x\n c');
  });

  it('keeps three lines of context around a change and skips the rest', () => {
    const committed = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const generated = ['1', '2', '3', '4', 'five', '6', '7', '8', '9'];

    expect(diff(committed, generated)).toBe('@@ -2,7 +2,7 @@\n 2\n 3\n 4\n-5\n+five\n 6\n 7\n 8');
  });

  it('numbers each hunk from the line it starts at', () => {
    const committed = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    const generated = ['A', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'K'];

    expect(diff(committed, generated)).toBe(
      [
        '@@ -1,4 +1,4 @@',
        '-a',
        '+A',
        ' b',
        ' c',
        ' d',
        '@@ -8,4 +8,4 @@',
        ' h',
        ' i',
        ' j',
        '-k',
        '+K',
      ].join('\n'),
    );
  });

  it('numbers an empty side from the line it follows', () => {
    expect(diff([], ['a'])).toBe('@@ -0,0 +1,1 @@\n+a');
    expect(diff(['a'], [])).toBe('@@ -1,1 +0,0 @@\n-a');
  });

  it('numbers an insertion in the middle from the line before it', () => {
    expect(diff(['a', 'b'], ['a', 'b'])).toBe('');
    expect(diff(['a'], ['a', 'b'])).toContain('@@ -1,1 +1,2 @@');
  });

  it('replaces the whole file rather than build an LCS table above its cap', () => {
    const committed = Array.from({ length: 2100 }, (_, index) => `old ${String(index)}`);
    const generated = Array.from({ length: 2100 }, (_, index) => `new ${String(index)}`);
    const lines = diff(committed, generated).split('\n');

    expect(lines[0]).toBe('@@ -1,2100 +1,2100 @@');
    expect(lines[1]).toBe('-old 0');
    expect(lines[2100]).toBe('-old 2099');
    expect(lines[2101]).toBe('+new 0');
    expect(lines.at(-1)).toBe('+new 2099');
  });

  it('leaves a shared prefix and suffix out of the table without changing the output', () => {
    const committed = ['a', 'b', 'c', 'd', 'e'];
    const generated = ['a', 'b', 'x', 'd', 'e'];

    expect(diff(committed, generated)).toBe('@@ -1,5 +1,5 @@\n a\n b\n-c\n+x\n d\n e');
  });
});
