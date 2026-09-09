import { describe, expect, it } from 'vitest';

import { isCronExpression } from './is-cron-expression.js';

describe('isCronExpression', () => {
  it.each([
    '* * * * *',
    '0 0 * * *',
    '*/5 * * * *',
    '0 9-17 * * 1-5',
    '0 0 1,15 * *',
    '30 2 * * MON',
    '0 0 * JAN,jul *',
    '0 0 * * 7',
    '0-30/15 * * * *',
    '0  0 * *\t*',
    ' 0 2 * * * ',
    '\t0 2 * * *\t',
    '1/5 * * * *',
    '*/120 * * * *',
    '0 0 * * MON-FRI',
    '0 0 * JAN-JUN *',
    '0 0 * * MON-3',
    '01 * * * *',
  ])('accepts %j as a cron expression', (value) => {
    expect(isCronExpression(value)).toBe(true);
  });

  it.each([
    '',
    '* * * *',
    '* * * * * *',
    '@daily',
    '60 * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8',
    '* * ? * *',
    '0 0 L * *',
    '0 0 15W * *',
    '0 0 * * 5#3',
    '*/0 * * * *',
    '0 17-9 * * *',
    '0 0 * * MON-SUN',
    '0 0 * * everyday',
    '0 0 * * JAN',
    '0 0 * MON *',
    '*-5 * * * *',
    '1-* * * * *',
    '*/5/2 * * * *',
    '1--5 * * * *',
    ',1 * * * *',
    '5- * * * *',
    '*/ * * * *',
  ])('refuses %j as a cron expression', (value) => {
    expect(isCronExpression(value)).toBe(false);
  });

  it('refuses a newline between two fields', () => {
    expect(isCronExpression('0 2 *\n* *')).toBe(false);
  });

  it('refuses a newline after the last field', () => {
    expect(isCronExpression('0 2 * * *\n')).toBe(false);
  });

  it('refuses a non-breaking space between two fields', () => {
    expect(isCronExpression('0\u00a02 * * *')).toBe(false);
  });

  it('refuses a name that reaches a name only by folding outside ASCII', () => {
    expect(isCronExpression('0 0 * * ſUN')).toBe(false);
  });
});
