export const VALIDATION_CODES = [
  "DuplicateResourceName",
  "DuplicateEnvKey",
  "ExtraFieldConflict",
  "DeprecatedField",
] as const;

export type ValidationCode = (typeof VALIDATION_CODES)[number];

export const WARNING_CODES = ["MissingBuildCommand", "MissingStartCommand"] as const;

export type WarningCode = (typeof WARNING_CODES)[number];

export interface ResourcePath {
  readonly resource: string;
  readonly field: string;
}

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly at: ResourcePath;
  readonly message: string;
}

export interface ValidationWarning {
  readonly code: WarningCode;
  readonly at: ResourcePath;
  readonly message: string;
}
