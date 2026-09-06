import * as z from 'zod';

export const AUTO_DEPLOY_TRIGGERS = ['off', 'commit', 'checksPass'] as const;

export type AutoDeployTrigger = (typeof AUTO_DEPLOY_TRIGGERS)[number];

export const autoDeployTriggerSchema: z.ZodEnum<z.core.util.ToEnum<AutoDeployTrigger>> =
  z.enum(AUTO_DEPLOY_TRIGGERS);
