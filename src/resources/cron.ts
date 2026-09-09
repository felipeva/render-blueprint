import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { cronPlanSchema, type CronPlan } from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import { raise } from '../raise.js';
import {
  opaqueServiceReference,
  type OpaqueServiceReference,
} from '../references/opaque-service-reference.js';
import type { BuildFilter } from './build-filter.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import type { EnvironmentGroup } from './env-group.js';
import { isCronExpression } from './is-cron-expression.js';
import { optionalSourcedServiceFields } from './service-fields.js';
import {
  dockerSourceFields,
  imageSourceFields,
  nativeSourceFields,
  type DockerSource,
  type ImageSource,
  type NativeSource,
} from './service-source.js';

const SCHEDULE_ERROR =
  'A cron job runs on a schedule, so `schedule` holds the cron expression Render runs it by.';

const notCronMessage = (value: string): string =>
  `A schedule is a cron expression of five fields — minute, hour, day of month, month and day of week, as in "0 2 * * *" — and "${value}" is not one.`;

// spec §4.1: five fields split on space or tab, each a comma list of "*", a value or a range, each
// with an optional /step. INFERRED: names, weekday 7, outer space ok; "@", a 6th field, ?LW# fail.
const scheduleSchema: z.ZodString = z
  .string({ error: SCHEDULE_ERROR })
  .superRefine((value, ctx) => {
    if (!isCronExpression(value)) {
      raise(ctx, 'ScheduleNotCron', notCronMessage(value), []);
    }
  });

// spec §4.8: a cron job has no disk, no scaling, no domains and no previews of its own.
interface CronFields {
  readonly schedule: string;
  readonly region?: Region;
  readonly plan?: CronPlan;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly buildFilter?: BuildFilter;
  readonly env?: ServiceEnvironment<OpaqueServiceReference>;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface NativeCronConfig extends CronFields, NativeSource {}

export interface DockerCronConfig extends CronFields, DockerSource {}

export interface ImageCronConfig extends CronFields, ImageSource {}

export type CronConfig = NativeCronConfig | DockerCronConfig | ImageCronConfig;

export interface CronJob extends OpaqueServiceReference {
  readonly kind: 'cron';
  readonly name: string;
  readonly config: CronConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's cronService property order.
export const CRON_JOB_FIELDS = [
  'type',
  'name',
  'region',
  'plan',
  'runtime',
  'schedule',
  'buildCommand',
  'startCommand',
  'dockerCommand',
  'dockerfilePath',
  'dockerContext',
  'registryCredential',
  'repo',
  'branch',
  'image',
  'envVars',
  'buildFilter',
  'rootDir',
  'autoDeployTrigger',
  'preDeployCommand',
] as const;

// spec §4.8: Render closes the cronService definition, so a cron job takes no property beyond these.
export const CRON_SERVICE_SCHEMA_FIELDS = [
  'type',
  'name',
  'region',
  'plan',
  'runtime',
  'schedule',
  'buildCommand',
  'startCommand',
  'dockerCommand',
  'dockerfilePath',
  'dockerContext',
  'registryCredential',
  'repo',
  'branch',
  'image',
  'envVars',
  'buildFilter',
  'rootDir',
  'autoDeploy',
  'autoDeployTrigger',
  'preDeployCommand',
] as const;
const cronFields = {
  ...optionalSourcedServiceFields,
  schedule: scheduleSchema,
  plan: cronPlanSchema.exactOptional(),
  env: serviceEnvironmentSchema<OpaqueServiceReference>().exactOptional(),
};

const cronConfigSchema = z.discriminatedUnion('runtime', [
  z.strictObject({ ...cronFields, ...nativeSourceFields }).readonly(),
  z.strictObject({ ...cronFields, ...dockerSourceFields }).readonly(),
  z.strictObject({ ...cronFields, ...imageSourceFields }).readonly(),
]);

type CronConfigSchemaMatchesInterface = Expect<Equal<z.infer<typeof cronConfigSchema>, CronConfig>>;

export const CRON_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies CronConfigSchemaMatchesInterface;

export const parseCronConfig = (config: CronConfig): z.ZodSafeParseResult<CronConfig> =>
  cronConfigSchema.safeParse(config);

// spec §6.2: a cron job answers on no address.
export const cron = (name: string, config: CronConfig): CronJob => ({
  kind: 'cron',
  name,
  config,
  ...opaqueServiceReference({ name, type: 'cron', origin: 'blueprint' }),
});
