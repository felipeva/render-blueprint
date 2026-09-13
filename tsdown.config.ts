import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', testing: 'src/testing.ts', cli: 'src/cli/main.ts' },
  format: 'esm',
  fixedExtension: false,
  dts: { sourcemap: false, entry: ['src/index.ts', 'src/testing.ts'] },
  treeshake: { moduleSideEffects: false },
  deps: { neverBundle: ['@drizzle-team/brocli', 'yaml', 'better-result', 'zod'] },
});
