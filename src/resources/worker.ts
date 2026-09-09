import * as z from 'zod';

import type { AutoDeployTrigger } from '../enums/auto-deploy-trigger.js';
import { paidServerPlanSchema, type PaidServerPlan } from '../enums/plan.js';
import type { Region } from '../enums/region.js';
import { serviceEnvironmentSchema, type ServiceEnvironment } from '../env/self-environment.js';
import type { Equal, Expect } from '../equal.js';
import type { JsonObject } from '../json.js';
import {
  opaqueServiceReference,
  type OpaqueServiceReference,
} from '../references/opaque-service-reference.js';
import type { BuildFilter } from './build-filter.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import { raiseDiskPreventsScaling, WHEN_DISK_PREVENTS_SCALING, type Disk } from './disk.js';
import type { EnvironmentGroup } from './env-group.js';
import { servicePreviewsSchema, type ServicePreviews } from './previews.js';
import type { Scaling } from './scaling.js';
import { optionalServerServiceFields, optionalSourcedServiceFields } from './service-fields.js';
import {
  dockerSourceFields,
  imageSourceFields,
  nativeSourceFields,
  type DockerSource,
  type ImageSource,
  type NativeSource,
} from './service-source.js';

// spec §16 F: healthCheckPath, domains, maintenanceMode and ipAllowList sit on the schema branch a
// worker shares with a web service.
interface WorkerFields {
  readonly region?: Region;
  readonly plan?: PaidServerPlan;
  readonly instances?: number;
  readonly scaling?: Scaling;
  readonly startCommand?: string;
  readonly preDeployCommand?: string;
  readonly autoDeployTrigger?: AutoDeployTrigger;
  readonly initialDeployHook?: string;
  readonly disk?: Disk;
  readonly buildFilter?: BuildFilter;
  readonly previews?: ServicePreviews<PaidServerPlan>;
  readonly maxShutdownDelaySeconds?: number;
  readonly env?: ServiceEnvironment<OpaqueServiceReference>;
  readonly envGroups?: readonly EnvironmentGroup[];
  readonly extraFields?: JsonObject;
}

export interface NativeWorkerConfig extends WorkerFields, NativeSource {}

export interface DockerWorkerConfig extends WorkerFields, DockerSource {}

export interface ImageWorkerConfig extends WorkerFields, ImageSource {}

export type WorkerConfig = NativeWorkerConfig | DockerWorkerConfig | ImageWorkerConfig;

export interface Worker extends OpaqueServiceReference {
  readonly kind: 'worker';
  readonly name: string;
  readonly config: WorkerConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's serverService property order.
export const WORKER_FIELDS = [
  'type',
  'name',
  'region',
  'plan',
  'runtime',
  'repo',
  'branch',
  'image',
  'rootDir',
  'dockerCommand',
  'dockerContext',
  'dockerfilePath',
  'numInstances',
  'scaling',
  'buildCommand',
  'startCommand',
  'preDeployCommand',
  'registryCredential',
  'envVars',
  'autoDeployTrigger',
  'initialDeployHook',
  'disk',
  'buildFilter',
  'previews',
  'maxShutdownDelaySeconds',
] as const;

const workerFields = {
  ...optionalSourcedServiceFields,
  ...optionalServerServiceFields,
  plan: paidServerPlanSchema.exactOptional(),
  previews: servicePreviewsSchema(paidServerPlanSchema).exactOptional(),
  env: serviceEnvironmentSchema<OpaqueServiceReference>().exactOptional(),
};

const workerConfigSchema = z
  .discriminatedUnion('runtime', [
    z.strictObject({ ...workerFields, ...nativeSourceFields }).readonly(),
    z.strictObject({ ...workerFields, ...dockerSourceFields }).readonly(),
    z.strictObject({ ...workerFields, ...imageSourceFields }).readonly(),
  ])
  .superRefine(raiseDiskPreventsScaling, WHEN_DISK_PREVENTS_SCALING);

type WorkerConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof workerConfigSchema>, WorkerConfig>
>;

export const WORKER_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies WorkerConfigSchemaMatchesInterface;

export const parseWorkerConfig = (config: WorkerConfig): z.ZodSafeParseResult<WorkerConfig> =>
  workerConfigSchema.safeParse(config);

// spec §6.2: a worker answers on no address.
export const worker = (name: string, config: WorkerConfig): Worker => ({
  kind: 'worker',
  name,
  config,
  ...opaqueServiceReference({ name, type: 'worker', origin: 'blueprint' }),
});
