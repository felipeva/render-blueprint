const CONTEXT_LINES = 3;

// An LCS table is quadratic; above this many cells a whole-file replace is the honest answer.
const MAX_TABLE_CELLS = 4_000_000;

interface DiffOp {
  readonly mark: '-' | '+' | ' ';
  readonly text: string;
}

interface PositionedOp extends DiffOp {
  readonly committedAt: number;
  readonly generatedAt: number;
}

const marked = (mark: DiffOp['mark'], lines: readonly string[]): readonly DiffOp[] =>
  lines.map((text) => ({ mark, text }));

const commonPrefix = (committed: readonly string[], generated: readonly string[]): number => {
  const limit = Math.min(committed.length, generated.length);
  let count = 0;

  while (count < limit && committed[count] === generated[count]) count += 1;

  return count;
};

const commonSuffix = (
  committed: readonly string[],
  generated: readonly string[],
  prefix: number,
): number => {
  const limit = Math.min(committed.length, generated.length) - prefix;
  let count = 0;

  while (
    count < limit &&
    committed[committed.length - 1 - count] === generated[generated.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
};

const middleOps = (
  committed: readonly string[],
  generated: readonly string[],
): readonly DiffOp[] => {
  if ((committed.length + 1) * (generated.length + 1) > MAX_TABLE_CELLS) {
    return [...marked('-', committed), ...marked('+', generated)];
  }

  const width = generated.length + 1;
  const common = Array.from<number>({ length: (committed.length + 1) * width }).fill(0);
  const commonAt = (row: number, column: number): number => common[row * width + column] ?? 0;

  for (let row = committed.length - 1; row >= 0; row -= 1) {
    for (let column = generated.length - 1; column >= 0; column -= 1) {
      common[row * width + column] =
        committed[row] === generated[column]
          ? commonAt(row + 1, column + 1) + 1
          : Math.max(commonAt(row + 1, column), commonAt(row, column + 1));
    }
  }

  const ops: DiffOp[] = [];
  let row = 0;
  let column = 0;

  while (row < committed.length || column < generated.length) {
    const left = committed[row];
    const right = generated[column];

    if (left !== undefined && right !== undefined && left === right) {
      ops.push({ mark: ' ', text: left });
      row += 1;
      column += 1;
    } else if (
      left !== undefined &&
      (right === undefined || commonAt(row + 1, column) >= commonAt(row, column + 1))
    ) {
      ops.push({ mark: '-', text: left });
      row += 1;
    } else if (right !== undefined) {
      ops.push({ mark: '+', text: right });
      column += 1;
    }
  }

  return ops;
};

const positioned = (ops: readonly DiffOp[]): readonly PositionedOp[] => {
  const placed: PositionedOp[] = [];
  let committedAt = 1;
  let generatedAt = 1;

  for (const op of ops) {
    placed.push({ ...op, committedAt, generatedAt });
    if (op.mark !== '+') committedAt += 1;
    if (op.mark !== '-') generatedAt += 1;
  }

  return placed;
};

const hunkRanges = (ops: readonly PositionedOp[]): readonly (readonly [number, number])[] => {
  const kept = Array.from<boolean>({ length: ops.length }).fill(false);

  ops.forEach((op, index) => {
    if (op.mark === ' ') return;

    const from = Math.max(0, index - CONTEXT_LINES);
    const to = Math.min(ops.length - 1, index + CONTEXT_LINES);

    for (let position = from; position <= to; position += 1) kept[position] = true;
  });

  const ranges: (readonly [number, number])[] = [];
  let index = 0;

  while (index < ops.length) {
    if (kept[index] !== true) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < ops.length && kept[index] === true) index += 1;
    ranges.push([start, index]);
  }

  return ranges;
};

// Unified diff numbers an empty side from the line it follows, so a count of zero backs up one.
const startOf = (position: number, count: number): number =>
  count === 0 ? position - 1 : position;

const hunk = (ops: readonly PositionedOp[]): readonly string[] => {
  const first = ops[0];

  if (first === undefined) return [];

  const removed = ops.filter((op) => op.mark !== '+').length;
  const added = ops.filter((op) => op.mark !== '-').length;
  const from = `-${String(startOf(first.committedAt, removed))},${String(removed)}`;
  const to = `+${String(startOf(first.generatedAt, added))},${String(added)}`;

  return [`@@ ${from} ${to} @@`, ...ops.map((op) => `${op.mark}${op.text}`)];
};

export const diff = (committed: readonly string[], generated: readonly string[]): string => {
  const prefix = commonPrefix(committed, generated);
  const suffix = commonSuffix(committed, generated, prefix);

  const ops = positioned([
    ...marked(' ', committed.slice(0, prefix)),
    ...middleOps(
      committed.slice(prefix, committed.length - suffix),
      generated.slice(prefix, generated.length - suffix),
    ),
    ...marked(' ', committed.slice(committed.length - suffix)),
  ]);

  return hunkRanges(ops)
    .flatMap(([start, end]) => hunk(ops.slice(start, end)))
    .join('\n');
};
