import type { AutoDeployTrigger } from "../enums/auto-deploy-trigger.js";
import type { ServerPlan } from "../enums/plan.js";
import type { Region } from "../enums/region.js";
import type { NativeRuntime } from "../enums/runtime.js";
import type { EnvironmentMap } from "../env/env-value.js";
import type { JsonObject } from "../json.js";

export type HealthCheckPath = `/${string}`;

export interface WebConfig {
  readonly runtime: NativeRuntime;
  readonly region?: Region;
  readonly plan?: ServerPlan;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly healthCheckPath?: HealthCheckPath;
  readonly buildCommand?: string;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly env?: EnvironmentMap;
  readonly extraFields?: JsonObject;
}

export interface WebService {
  readonly kind: "web";
  readonly name: string;
  readonly config: WebConfig;
}

// Emission order follows the schema's serverService property order.
export const WEB_SERVICE_FIELDS = [
  "type",
  "name",
  "region",
  "plan",
  "runtime",
  "repo",
  "branch",
  "rootDir",
  "healthCheckPath",
  "buildCommand",
  "startCommand",
  "preDeployCommand",
  "envVars",
  "autoDeployTrigger",
] as const;

export const web = (name: string, config: WebConfig): WebService => ({
  kind: "web",
  name,
  config,
});
