import type * as z from 'zod';

import type { RenderSubdomainPolicy } from '../enums/render-subdomain-policy.js';
import { raise, whenFieldsParsed, type RefinementOptions } from '../raise.js';

// spec §4.8 gives both fields to web services and static sites.
export interface SubdomainFields {
  readonly renderSubdomainPolicy?: RenderSubdomainPolicy;
  readonly domains?: readonly string[];
}

// spec §4.1: `disabled` requires at least one custom domain.
export const raiseSubdomainPolicyNeedsDomain = <T extends SubdomainFields>(
  config: T,
  ctx: z.core.$RefinementCtx<T>,
): void => {
  if (config.renderSubdomainPolicy !== 'disabled') return;
  if (config.domains !== undefined && config.domains.length > 0) return;

  raise(
    ctx,
    'SubdomainPolicyNeedsDomain',
    'A renderSubdomainPolicy of "disabled" leaves the custom domains as the only address Render answers on, and this resource lists none; add one to domains or leave the policy enabled.',
    ['renderSubdomainPolicy'],
  );
};

export const WHEN_SUBDOMAIN_POLICY_NEEDS_DOMAIN: RefinementOptions = whenFieldsParsed([
  'runtime',
  'renderSubdomainPolicy',
  'domains',
]);
