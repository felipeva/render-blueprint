import * as z from 'zod';

import { autoDeployTriggerSchema, type AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { raise } from '../raise.js';
import { environmentGroupSchema, type EnvironmentGroup } from './env-group.js';

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
  envGroups: commonServiceFields.envGroups.exactOptional(),
  extraFields: commonServiceFields.extraFields.exactOptional(),
};
