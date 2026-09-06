import * as z from 'zod';

import type { EnvironmentMap } from './env-value.js';

// spec §6.6: a service may reference itself. The callback takes the enclosing resource's own
// handle, so the reference is typed to its kind and no cycle and no mutation is needed.
export type SelfEnvironment<H> = (self: H) => EnvironmentMap;

export type ServiceEnvironment<H> = EnvironmentMap | SelfEnvironment<H>;

// The map's own contents are parsed once the callback is resolved, in resourceEnvIssues. A union
// of the two forms here would report one invalid_union issue on `env` and lose the key at fault.
export const serviceEnvironmentSchema = <H>(): z.ZodType<ServiceEnvironment<H>> =>
  z.custom<ServiceEnvironment<H>>();

// SAFETY: `typeof` narrows a representation rather than a domain value, and `instanceof` reads a
// prototype chain the CLI's dynamic import can source from another realm. Object.prototype.toString
// answers the value's own builtin tag, which no realm changes, and only a callable answers this one.
const isSelfEnvironment = <H>(value: ServiceEnvironment<H>): value is SelfEnvironment<H> =>
  Object.prototype.toString.call(value) === '[object Function]';

export const selfEnvironment = <H>(
  env: ServiceEnvironment<H> | undefined,
  self: H,
): EnvironmentMap | undefined => {
  if (env === undefined) return undefined;
  return isSelfEnvironment(env) ? env(self) : env;
};
