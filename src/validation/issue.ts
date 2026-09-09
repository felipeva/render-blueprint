export const VALIDATION_CODES = [
  'InvalidConfig',
  'UnknownField',
  'ConflictingSource',
  'RootDirNotRelative',
  'OutOfRange',
  'CyclicExtraFields',
  'DuplicateResourceName',
  'DuplicateEnvKey',
  'EnvKeyCollision',
  'ExtraFieldConflict',
  'DeprecatedField',
  'ResourceInMultipleLocations',
  'DanglingReference',
  'HighAvailabilityUnsupported',
  'TooManyReadReplicas',
  'ScalingRangeInverted',
  'ScalingTargetMissing',
  'DiskPreventsScaling',
  'MountPathDisallowed',
  'MaintenanceUriNotAbsolute',
  'SubdomainPolicyNeedsDomain',
  'ProjectWithoutEnvironment',
  'DiskSizeDisallowed',
] as const;

export type ValidationCode = (typeof VALIDATION_CODES)[number];

export const WARNING_CODES = [
  'MissingBuildCommand',
  'MissingStartCommand',
  'MissingStaticPublishPath',
  'BranchDisablesPreviews',
  'SecretSkipsPreviews',
  'UnknownServiceEnvVarKey',
  'WebOnlyField',
  'InstancesIgnoredByScaling',
  'UnusedDefault',
  'BuildFilterOnImageSource',
  'MaintenanceModeNeedsPaidPlan',
  'AutoDeployTriggerOnImageSource',
  'PreviewValueIgnored',
  'PersistenceNeedsPaidPlan',
] as const;

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
