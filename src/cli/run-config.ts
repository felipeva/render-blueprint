import type { BroCliConfig } from '@drizzle-team/brocli';

// brocli 0.12.1 reads config.noExit at runtime (index.js, the catch at the foot of run) but leaves
// it out of BroCliConfig, so the CLI names it here rather than handing run() an object literal
// TypeScript would reject for the excess property.
export interface RunConfig extends BroCliConfig {
  readonly noExit: boolean;
}
