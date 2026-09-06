const CONTEXT_LINES = 3;

interface DiffOp {
  readonly mark: '-' | '+' | ' ';
  readonly text: string;
  readonly committedAt: number;
  readonly generatedAt: number;
}

const operations = (
  committed: readonly string[],
  generated: readonly string[],
): readonly DiffOp[] => {
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
      ops.push({ mark: ' ', text: left, committedAt: row + 1, generatedAt: column + 1 });
      row += 1;
      column += 1;
    } else if (
      left !== undefined &&
      (right === undefined || commonAt(row + 1, column) >= commonAt(row, column + 1))
    ) {
      ops.push({ mark: '-', text: left, committedAt: row + 1, generatedAt: column + 1 });
      row += 1;
    } else if (right !== undefined) {
      ops.push({ mark: '+', text: right, committedAt: row + 1, generatedAt: column + 1 });
      column += 1;
    }
  }

  return ops;
};

const hunkRanges = (ops: readonly DiffOp[]): readonly (readonly [number, number])[] => {
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

const hunk = (ops: readonly DiffOp[]): readonly string[] => {
  const first = ops[0];

  if (first === undefined) return [];

  const removed = ops.filter((op) => op.mark !== '+').length;
  const added = ops.filter((op) => op.mark !== '-').length;

  return [
    `@@ -${String(first.committedAt)},${String(removed)} +${String(first.generatedAt)},${String(added)} @@`,
    ...ops.map((op) => `${op.mark}${op.text}`),
  ];
};

// The committed file is the baseline, so a removed line is what is on disk today.
export const diff = (committed: readonly string[], generated: readonly string[]): string => {
  const ops = operations(committed, generated);

  return hunkRanges(ops)
    .flatMap(([start, end]) => hunk(ops.slice(start, end)))
    .join('\n');
};
