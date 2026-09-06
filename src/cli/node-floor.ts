// docs/research/toolchain.md: the floor is the version where type stripping is unflagged, and
// package.json's engines.node declares the same number.
export const NODE_FLOOR = '22.18.0';

const parts = (version: string): readonly number[] =>
  (version.startsWith('v') ? version.slice(1) : version)
    .split('.')
    .map((part) => Number.parseInt(part, 10));

export const belowNodeFloor = (version: string): boolean => {
  const running = parts(version);
  const floor = parts(NODE_FLOOR);

  for (const [index, required] of floor.entries()) {
    const found = running[index] ?? 0;

    if (found !== required) return found < required;
  }

  return false;
};
