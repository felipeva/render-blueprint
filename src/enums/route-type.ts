export const ROUTE_TYPES = ['redirect', 'rewrite'] as const;

export type RouteType = (typeof ROUTE_TYPES)[number];
