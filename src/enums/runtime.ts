export const NATIVE_RUNTIMES = ["node", "python", "go", "ruby", "rust", "elixir"] as const;

export type NativeRuntime = (typeof NATIVE_RUNTIMES)[number];
