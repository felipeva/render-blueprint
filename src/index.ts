export type { JsonObject, JsonValue } from './json.js';

export type { AutoDeployTrigger } from './enums/auto-deploy-trigger.js';
export type { ServerPlan } from './enums/plan.js';
export type { Region } from './enums/region.js';
export type { NativeRuntime } from './enums/runtime.js';

export type { EnvironmentMap, EnvValue } from './env/env-value.js';

export { web } from './resources/web.js';
export type { HealthCheckPath, WebConfig, WebService } from './resources/web.js';
export type { BlueprintResource } from './resources/resource.js';

export { blueprint } from './blueprint/blueprint.js';
export type { Blueprint, BlueprintConfig } from './blueprint/blueprint.js';

export { BlueprintInvalid } from './validation/blueprint-invalid.js';
export type { ValidationIssues } from './validation/blueprint-invalid.js';
export type {
  ResourcePath,
  ValidationCode,
  ValidationIssue,
  ValidationWarning,
  WarningCode,
} from './validation/issue.js';

export { synthesize } from './synth/synthesize.js';
export type { SynthesisReport } from './synth/synthesize.js';

export { writeBlueprint } from './fs/write-blueprint.js';
export type { WriteOptions, WriteReport } from './fs/write-blueprint.js';
export { BlueprintWriteFailed } from './fs/write-text-file.js';
export { BlueprintFileUnreadable } from './fs/read-text-file.js';
export type { FilePort, FileReader, FileWriter } from './fs/file-port.js';

export { checkBlueprint } from './drift/check-blueprint.js';
export type { CheckOptions, DriftReport } from './drift/check-blueprint.js';
export type {
  DriftSection,
  ImmutableField,
  ImmutableFieldChange,
} from './drift/immutable-field.js';
