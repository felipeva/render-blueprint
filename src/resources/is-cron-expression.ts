const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

interface CronFieldGrammar {
  readonly min: number;
  readonly max: number;
  readonly names: readonly string[];
}

const CRON_FIELD_GRAMMARS: readonly CronFieldGrammar[] = [
  { min: 0, max: 59, names: [] },
  { min: 0, max: 23, names: [] },
  { min: 1, max: 31, names: [] },
  { min: 1, max: 12, names: MONTH_NAMES },
  { min: 0, max: 7, names: WEEKDAY_NAMES },
];

const DIGITS = /^[0-9]+$/u;

const fieldValue = (token: string, grammar: CronFieldGrammar): number | undefined => {
  const named = grammar.names.indexOf(token.toUpperCase());
  if (named !== -1) return named + grammar.min;
  if (!DIGITS.test(token)) return undefined;

  const value = Number(token);
  return value >= grammar.min && value <= grammar.max ? value : undefined;
};

const rangeMatches = (token: string, grammar: CronFieldGrammar): boolean => {
  if (token === '*') return true;

  const [start = '', end, ...extra] = token.split('-');
  if (extra.length > 0) return false;

  const low = fieldValue(start, grammar);
  if (low === undefined) return false;
  if (end === undefined) return true;

  const high = fieldValue(end, grammar);
  return high !== undefined && low <= high;
};

const itemMatches = (token: string, grammar: CronFieldGrammar): boolean => {
  const [range = '', step, ...extra] = token.split('/');
  if (extra.length > 0) return false;
  if (step !== undefined && !(DIGITS.test(step) && Number(step) >= 1)) return false;

  return rangeMatches(range, grammar);
};

const fieldMatches = (token: string, grammar: CronFieldGrammar): boolean =>
  token.split(',').every((item) => itemMatches(item, grammar));

export const isCronExpression = (value: string): boolean => {
  const fields = value.trim().split(/\s+/u);

  return (
    fields.length === CRON_FIELD_GRAMMARS.length &&
    CRON_FIELD_GRAMMARS.every((grammar, index) => fieldMatches(fields[index] ?? '', grammar))
  );
};
