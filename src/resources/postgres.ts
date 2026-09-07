import * as z from 'zod';

import { connectionPoolSchema, type ConnectionPool } from '../enums/connection-pool.js';
import { diskSizeGBSchema, type DiskSizeGB } from '../enums/disk-size.js';
import { postgresPlanSchema, type PostgresPlan } from '../enums/plan.js';
import {
  postgresMajorVersionSchema,
  type PostgresMajorVersion,
} from '../enums/postgres-major-version.js';
import { regionSchema, type Region } from '../enums/region.js';
import type { Equal, Expect } from '../equal.js';
import { jsonObjectSchema, type JsonObject } from '../json.js';
import { raise } from '../raise.js';
import { postgresReference, type PostgresReference } from '../references/postgres-reference.js';
import type { DefaultsProvenance } from './defaults-provenance.js';
import { ipAllowListSchema, type IpAllowList } from './ip-allow-list.js';
import { readReplicaSchema, type ReadReplica } from './read-replica.js';

export interface HighAvailability {
  readonly enabled: boolean;
}

// spec §11: a database has no previews object of its own on Render.
export interface PostgresPreviews {
  readonly plan?: PostgresPlan;
  readonly diskSizeGB?: DiskSizeGB;
}

export interface PostgresConfig {
  readonly region?: Region;
  readonly plan?: PostgresPlan;
  readonly databaseName?: string;
  readonly user?: string;
  readonly postgresMajorVersion?: PostgresMajorVersion;
  readonly diskSizeGB?: DiskSizeGB;
  readonly storageAutoscalingEnabled?: boolean;
  readonly connectionPool?: ConnectionPool;
  readonly previews?: PostgresPreviews;
  readonly highAvailability?: HighAvailability;
  readonly ipAllowList?: IpAllowList;
  readonly readReplicas?: readonly ReadReplica[];
  readonly extraFields?: JsonObject;
}

export interface PostgresDatabase extends PostgresReference {
  readonly kind: 'postgres';
  readonly name: string;
  readonly config: PostgresConfig;
  readonly defaults?: DefaultsProvenance;
}

// Emission order follows the schema's highAvailability property order.
export const HIGH_AVAILABILITY_FIELDS = ['enabled'] as const;

// Emission order follows the schema's database property order.
export const POSTGRES_DATABASE_FIELDS = [
  'name',
  'databaseName',
  'user',
  'region',
  'plan',
  'diskSizeGB',
  'storageAutoscalingEnabled',
  'connectionPool',
  'previewPlan',
  'previewDiskSizeGB',
  'postgresMajorVersion',
  'highAvailability',
  'ipAllowList',
  'readReplicas',
] as const;

// spec §9: high availability needs PostgreSQL 13 or later.
const FIRST_HIGH_AVAILABILITY_VERSION = 13;

// spec §9: a Postgres instance takes at most five read replicas.
const MAX_READ_REPLICAS = 5;

const postgresConfigSchema = z
  .strictObject({
    region: regionSchema.exactOptional(),
    plan: postgresPlanSchema.exactOptional(),
    databaseName: z.string().exactOptional(),
    user: z.string().exactOptional(),
    postgresMajorVersion: postgresMajorVersionSchema.exactOptional(),
    diskSizeGB: diskSizeGBSchema.exactOptional(),
    storageAutoscalingEnabled: z.boolean().exactOptional(),
    connectionPool: connectionPoolSchema.exactOptional(),
    previews: z
      .strictObject({
        plan: postgresPlanSchema.exactOptional(),
        diskSizeGB: diskSizeGBSchema.exactOptional(),
      })
      .readonly()
      .exactOptional(),
    highAvailability: z.strictObject({ enabled: z.boolean() }).readonly().exactOptional(),
    ipAllowList: ipAllowListSchema.exactOptional(),
    readReplicas: z
      .array(readReplicaSchema)
      .readonly()
      .superRefine((replicas, ctx) => {
        if (replicas.length > MAX_READ_REPLICAS) {
          raise(
            ctx,
            'TooManyReadReplicas',
            `Render gives a Postgres instance at most ${MAX_READ_REPLICAS} read replicas, and this one lists ${replicas.length}.`,
            [],
          );
        }
      })
      .exactOptional(),
    extraFields: jsonObjectSchema.exactOptional(),
  })
  .readonly()
  .superRefine((config, ctx) => {
    const version = config.postgresMajorVersion;

    if (
      config.highAvailability?.enabled === true &&
      version !== undefined &&
      Number(version) < FIRST_HIGH_AVAILABILITY_VERSION
    ) {
      raise(
        ctx,
        'HighAvailabilityUnsupported',
        `High availability needs PostgreSQL ${FIRST_HIGH_AVAILABILITY_VERSION} or later, and this database asks for version "${version}".`,
        ['highAvailability'],
      );
    }
  });

type PostgresConfigSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof postgresConfigSchema>, PostgresConfig>
>;

export const POSTGRES_CONFIG_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies PostgresConfigSchemaMatchesInterface;

export const parsePostgresConfig = (config: PostgresConfig): z.ZodSafeParseResult<PostgresConfig> =>
  postgresConfigSchema.safeParse(config);

export const postgres = (name: string, config: PostgresConfig = {}): PostgresDatabase => ({
  kind: 'postgres',
  name,
  config,
  ...postgresReference(name, 'blueprint'),
});
