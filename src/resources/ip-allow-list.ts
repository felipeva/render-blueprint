export interface IpAllowListEntry {
  readonly source: string;
  readonly description?: string;
}

export type IpAllowList = readonly IpAllowListEntry[];

// Emission order follows the schema's ipAllowList item property order.
export const IP_ALLOW_LIST_ENTRY_FIELDS = ['source', 'description'] as const;
