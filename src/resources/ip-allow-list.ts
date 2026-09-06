export interface IpAllowListEntry {
  readonly source: string;
  readonly description?: string;
}

export type IpAllowList = readonly IpAllowListEntry[];
