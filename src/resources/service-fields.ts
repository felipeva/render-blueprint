import * as z from 'zod';

import { boundedInteger, INSTANCE_COUNT_BOUNDS } from '../bounded-integer.js';
import { autoDeployTriggerSchema, type AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { regionSchema, type Region } from '../enums/region.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { raise } from '../raise.js';
import { buildFilterSchema, type BuildFilter } from './build-filter.js';
import { diskSchema, type Disk } from './disk.js';
import { environmentGroupSchema, type EnvironmentGroup } from './env-group.js';
import { scalingSchema, type Scaling } from './scaling.js';

const rootDirSchema: z.ZodString = z.string().superRefine((value, ctx) => {
  // spec §4.1 makes rootDir relative to the repository root. INFERRED: the schema does not.
  if (value.startsWith('/')) {
    raise(
      ctx,
      'RootDirNotRelative',
      'A rootDir is relative to the repository root, so it does not start with "/".',
      [],
    );
  }
});

// env is missing on purpose: its callback form is typed to the enclosing kind's own handle, so
// each factory declares its own.
export interface CommonServiceFields {
  readonly repo: z.ZodString;
  readonly branch: z.ZodString;
  readonly rootDir: z.ZodString;
  readonly buildCommand: z.ZodString;
  readonly preDeployCommand: z.ZodString;
  readonly autoDeployTrigger: z.ZodEnum<z.core.util.ToEnum<AutoDeployTrigger>>;
  readonly buildFilter: z.ZodType<BuildFilter>;
  readonly envGroups: z.ZodReadonly<z.ZodArray<z.ZodType<EnvironmentGroup>>>;
  readonly extraFields: z.ZodType<JsonObject>;
}

export const commonServiceFields: CommonServiceFields = {
  repo: z.string(),
  branch: z.string(),
  rootDir: rootDirSchema,
  buildCommand: z.string(),
  preDeployCommand: z.string(),
  autoDeployTrigger: autoDeployTriggerSchema,
  buildFilter: buildFilterSchema,
  envGroups: z.array(environmentGroupSchema).readonly(),
  extraFields: jsonObjectSchema,
};

export type OptionalCommonServiceFields = {
  readonly [K in keyof CommonServiceFields]: z.ZodExactOptional<CommonServiceFields[K]>;
};

export const optionalCommonServiceFields: OptionalCommonServiceFields = {
  repo: commonServiceFields.repo.exactOptional(),
  branch: commonServiceFields.branch.exactOptional(),
  rootDir: commonServiceFields.rootDir.exactOptional(),
  buildCommand: commonServiceFields.buildCommand.exactOptional(),
  preDeployCommand: commonServiceFields.preDeployCommand.exactOptional(),
  autoDeployTrigger: commonServiceFields.autoDeployTrigger.exactOptional(),
  buildFilter: commonServiceFields.buildFilter.exactOptional(),
  envGroups: commonServiceFields.envGroups.exactOptional(),
  extraFields: commonServiceFields.extraFields.exactOptional(),
};

// The fields the four kinds that choose a source share whatever source they choose. A static site
// chooses none and runs no start command, so it spreads the common map above instead.
export interface OptionalSourcedServiceFields {
  readonly region: z.ZodExactOptional<z.ZodEnum<z.core.util.ToEnum<Region>>>;
  readonly startCommand: z.ZodExactOptional<z.ZodString>;
  readonly preDeployCommand: z.ZodExactOptional<CommonServiceFields['preDeployCommand']>;
  readonly autoDeployTrigger: z.ZodExactOptional<CommonServiceFields['autoDeployTrigger']>;
  readonly buildFilter: z.ZodExactOptional<CommonServiceFields['buildFilter']>;
  readonly envGroups: z.ZodExactOptional<CommonServiceFields['envGroups']>;
  readonly extraFields: z.ZodExactOptional<CommonServiceFields['extraFields']>;
}

export const optionalSourcedServiceFields: OptionalSourcedServiceFields = {
  region: regionSchema.exactOptional(),
  startCommand: z.string().exactOptional(),
  preDeployCommand: optionalCommonServiceFields.preDeployCommand,
  autoDeployTrigger: optionalCommonServiceFields.autoDeployTrigger,
  buildFilter: optionalCommonServiceFields.buildFilter,
  envGroups: optionalCommonServiceFields.envGroups,
  extraFields: optionalCommonServiceFields.extraFields,
};

// spec §4.8: a disk, an instance count, autoscaling and the shutdown delay sit on the serverService
// branch alone, so a cron job and a static site spread neither this map nor its fields.
export interface OptionalServerServiceFields {
  readonly disk: z.ZodExactOptional<z.ZodType<Disk>>;
  readonly instances: z.ZodExactOptional<z.ZodInt>;
  readonly scaling: z.ZodExactOptional<z.ZodType<Scaling>>;
  readonly maxShutdownDelaySeconds: z.ZodExactOptional<z.ZodInt>;
}

export const optionalServerServiceFields: OptionalServerServiceFields = {
  disk: diskSchema.exactOptional(),
  instances: boundedInteger(INSTANCE_COUNT_BOUNDS).exactOptional(),
  scaling: scalingSchema.exactOptional(),
  maxShutdownDelaySeconds: boundedInteger({
    subject: 'A shutdown delay in seconds',
    min: 1,
    max: 300,
  }).exactOptional(),
};
