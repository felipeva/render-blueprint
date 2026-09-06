export const packageName = "render-blueprint" as const;

export type { JsonObject, JsonValue } from "./json.js";

export type { AutoDeployTrigger } from "./enums/auto-deploy-trigger.js";
export type { ServerPlan } from "./enums/plan.js";
export type { Region } from "./enums/region.js";
export type { NativeRuntime } from "./enums/runtime.js";

export type { EnvironmentMap, EnvValue } from "./env/env-value.js";

export { web } from "./resources/web.js";
export type { HealthCheckPath, WebConfig, WebService } from "./resources/web.js";
export type { BlueprintResource } from "./resources/resource.js";

export { blueprint } from "./blueprint/blueprint.js";
export type { Blueprint, BlueprintConfig } from "./blueprint/blueprint.js";

export { BlueprintInvalid } from "./validation/blueprint-invalid.js";
export type { ValidationIssues } from "./validation/blueprint-invalid.js";
export type {
  ResourcePath,
  ValidationCode,
  ValidationIssue,
  ValidationWarning,
  WarningCode,
} from "./validation/issue.js";
export { validate } from "./validation/validate.js";
export type { ValidatedBlueprint } from "./validation/validate.js";

export { synthesize } from "./synth/synthesize.js";
export type { SynthesisReport } from "./synth/synthesize.js";
