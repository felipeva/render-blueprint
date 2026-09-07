import type * as z from 'zod';

import type { RenderSubdomainPolicy } from '../enums/render-subdomain-policy.js';
import { raise } from '../raise.js';

// The pair the policy rule reads. spec §4.8 gives both fields to web services and static sites,
// and the rule is a cross-field one of the single config that carries them.
export interface SubdomainFields {
  readonly renderSubdomainPolicy?: RenderSubdomainPolicy;
  readonly domains?: readonly string[];
}

// spec §4.1: `disabled` requires at least one custom domain, because the onrender.com subdomain is
// then the address Render stops answering on.
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
