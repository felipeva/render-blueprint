import * as z from 'zod';

export const NATIVE_RUNTIMES = ['node', 'python', 'go', 'ruby', 'rust', 'elixir'] as const;

export type NativeRuntime = (typeof NATIVE_RUNTIMES)[number];

export const nativeRuntimeSchema: z.ZodEnum<z.core.util.ToEnum<NativeRuntime>> =
  z.enum(NATIVE_RUNTIMES);

// spec §3.2: Render's runtime enum also carries the two that pick a source instead of a language,
// and `static`, which belongs to a static site alone.
export const SERVICE_RUNTIMES = [
  'node',
  'python',
  'go',
  'ruby',
  'rust',
  'elixir',
  'docker',
  'image',
] as const;

export type ServiceRuntime = (typeof SERVICE_RUNTIMES)[number];
