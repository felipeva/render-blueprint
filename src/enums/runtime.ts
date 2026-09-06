import * as z from 'zod';

export const NATIVE_RUNTIMES = ['node', 'python', 'go', 'ruby', 'rust', 'elixir'] as const;

export type NativeRuntime = (typeof NATIVE_RUNTIMES)[number];

export const nativeRuntimeSchema: z.ZodEnum<z.core.util.ToEnum<NativeRuntime>> =
  z.enum(NATIVE_RUNTIMES);
