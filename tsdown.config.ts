import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', testing: 'src/testing.ts', cli: 'src/cli/main.ts' },
  format: 'esm',
  fixedExtension: false,
  dts: true,
  treeshake: { moduleSideEffects: false },
  deps: { neverBundle: ['yaml', 'better-result', 'zod'] },
});
