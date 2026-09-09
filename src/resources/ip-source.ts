const HEX_DIGITS: ReadonlySet<string> = new Set('0123456789abcdefABCDEF');

const isDigits = (text: string): boolean => {
  for (const character of text) {
    if (character < '0' || character > '9') return false;
  }

  return true;
};

const isDecimalWithin = (text: string, max: number): boolean => {
  if (!isDigits(text) || text.length > 3) return false;
  if (text.length > 1 && text.startsWith('0')) return false;

  return Number.parseInt(text, 10) <= max;
};

const isIpv4 = (text: string): boolean => {
  const octets = text.split('.');

  return octets.length === 4 && octets.every((octet) => isDecimalWithin(octet, 255));
};

const isHexGroup = (text: string): boolean => {
  if (text.length === 0 || text.length > 4) return false;

  for (const character of text) {
    if (!HEX_DIGITS.has(character)) return false;
  }

  return true;
};

const groupCount = (text: string, trailingIpv4: boolean): number | undefined => {
  if (text.length === 0) return 0;

  const pieces = text.split(':');
  let count = 0;

  for (const [index, piece] of pieces.entries()) {
    if (trailingIpv4 && index === pieces.length - 1 && piece.includes('.')) {
      if (!isIpv4(piece)) return undefined;

      count += 2;
      continue;
    }

    if (!isHexGroup(piece)) return undefined;

    count += 1;
  }

  return count;
};

const isIpv6 = (text: string): boolean => {
  const marker = text.indexOf('::');
  if (marker === -1) return groupCount(text, true) === 8;

  const before = groupCount(text.slice(0, marker), false);
  const after = groupCount(text.slice(marker + 2), true);
  if (before === undefined || after === undefined) return false;

  return before + after <= 7;
};

// spec §7 states no grammar, so this one is INFERRED: the RFC 4291 text forms for IPv6 and a dotted
// quad for IPv4, an optional prefix length within the family's range, no zone identifier, and no
// leading zero on an octet or a prefix length, which every C-derived resolver reads as octal.
export const isIpSource = (value: string): boolean => {
  const slash = value.indexOf('/');
  const address = slash === -1 ? value : value.slice(0, slash);
  const sixFamily = address.includes(':');

  if (!(sixFamily ? isIpv6(address) : isIpv4(address))) return false;

  return slash === -1 || isDecimalWithin(value.slice(slash + 1), sixFamily ? 128 : 32);
};
