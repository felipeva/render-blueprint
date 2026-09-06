import * as z from 'zod';

export const ROUTE_TYPES = ['redirect', 'rewrite'] as const;

export type RouteType = (typeof ROUTE_TYPES)[number];

export const routeTypeSchema: z.ZodEnum<z.core.util.ToEnum<RouteType>> = z.enum(ROUTE_TYPES);
