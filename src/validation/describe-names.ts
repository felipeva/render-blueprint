export const describeNames = (names: readonly string[]): string => {
  const quoted = names.map((name) => `"${name}"`);
  const last = quoted.at(-1) ?? '';
  const rest = quoted.slice(0, -1);

  return rest.length === 0 ? last : `${rest.join(', ')} and ${last}`;
};
