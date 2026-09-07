// A committed .ts rather than a seed, so tsconfig.check.json compiles this file. Its imports must
// stay type-only: Node's stripping erases those, so the specifier below never has to resolve from
// the temporary directory the seed is copied into.
import type { ResourceFactories, WebService } from '../../../../src/index.js';

export const apiService = (factories: ResourceFactories): WebService =>
  factories.web('api', {
    runtime: 'node',
    buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
    startCommand: 'pnpm start',
    env: { LOG_FORMAT: 'json' },
  });
