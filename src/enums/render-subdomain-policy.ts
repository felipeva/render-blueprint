import * as z from 'zod';

// spec §4.1: `disabled` reaches a resource at its custom domains alone.
export const RENDER_SUBDOMAIN_POLICIES = ['enabled', 'disabled'] as const;

export type RenderSubdomainPolicy = (typeof RENDER_SUBDOMAIN_POLICIES)[number];

export const renderSubdomainPolicySchema: z.ZodEnum<z.core.util.ToEnum<RenderSubdomainPolicy>> =
  z.enum(RENDER_SUBDOMAIN_POLICIES);
