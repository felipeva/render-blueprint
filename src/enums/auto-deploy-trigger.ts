export const AUTO_DEPLOY_TRIGGERS = ['off', 'commit', 'checksPass'] as const;

export type AutoDeployTrigger = (typeof AUTO_DEPLOY_TRIGGERS)[number];
