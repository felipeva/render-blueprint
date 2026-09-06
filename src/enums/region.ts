export const REGIONS = ["oregon", "ohio", "frankfurt", "singapore", "virginia"] as const;

export type Region = (typeof REGIONS)[number];
