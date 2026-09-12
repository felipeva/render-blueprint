import * as z from 'zod';

import { boundedInteger } from '../bounded-integer.js';
import type { Equal, Expect } from '../equal.js';
import {
  raise,
  readingFields,
  whenFieldsParsed,
  type FieldRefinement,
  type RefinementOptions,
} from '../raise.js';
import type { Scaling } from './scaling.js';

// spec §4.4: a disk needs a name and a mount path.
export interface Disk {
  readonly name: string;
  readonly mountPath: string;
  readonly sizeGB?: number;
}

// Emission order follows the schema's disk property order.
export const DISK_FIELDS = ['name', 'mountPath', 'sizeGB'] as const;

// docs/research/raw/render-disks.md § "Disallowed mount paths"
const DISALLOWED_MOUNT_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/opt',
  '/opt/render',
  '/opt/render/project',
  '/opt/render/project/src',
  '/home',
  '/home/render',
  '/etc',
  '/etc/secrets',
]);

const diskObject = z
  .strictObject({
    name: z.string(),
    mountPath: z.string(),
    sizeGB: boundedInteger({ subject: 'A disk size in GB', min: 1 }).exactOptional(),
  })
  .readonly()
  .superRefine(
    (value, ctx) => {
      if (DISALLOWED_MOUNT_PATHS.has(value.mountPath)) {
        raise(
          ctx,
          'MountPathDisallowed',
          `Render reserves "${value.mountPath}" and mounts no disk there; a directory under it is allowed.`,
          ['mountPath'],
        );
      }
    },
    whenFieldsParsed(['mountPath']),
  );

type DiskSchemaMatchesInterface = Expect<Equal<z.infer<typeof diskObject>, Disk>>;

export const DISK_SCHEMA_MATCHES_INTERFACE: true = true satisfies DiskSchemaMatchesInterface;

export const diskSchema: z.ZodType<Disk> = diskObject;

export interface ScalableFields {
  readonly disk?: Disk;
  readonly instances?: number;
  readonly scaling?: Scaling;
}

const DISK_PREVENTS_AUTOSCALING: FieldRefinement = readingFields(['runtime', 'disk', 'scaling']);

// docs/research/raw/render-disks.md § "Disk limitations and considerations"
export const raiseDiskPreventsAutoscaling = <T extends ScalableFields>(
  config: T,
  ctx: z.core.$RefinementCtx<T>,
): void => {
  if (config.disk === undefined) return;

  if (config.scaling !== undefined) {
    DISK_PREVENTS_AUTOSCALING.raise(
      ctx,
      'DiskPreventsScaling',
      'A service with a disk runs on one instance, so Render cannot autoscale it; drop the disk or drop scaling.',
      ['scaling'],
    );
  }
};

export const WHEN_DISK_PREVENTS_AUTOSCALING: RefinementOptions = DISK_PREVENTS_AUTOSCALING.guard;

const DISK_PREVENTS_MULTIPLE_INSTANCES: FieldRefinement = readingFields([
  'runtime',
  'disk',
  'instances',
]);

// docs/research/raw/render-disks.md § "Disk limitations and considerations"
export const raiseDiskPreventsMultipleInstances = <T extends ScalableFields>(
  config: T,
  ctx: z.core.$RefinementCtx<T>,
): void => {
  if (config.disk === undefined) return;

  if (config.instances !== undefined && config.instances > 1) {
    DISK_PREVENTS_MULTIPLE_INSTANCES.raise(
      ctx,
      'DiskPreventsScaling',
      `A service with a disk runs on one instance, and this one asks for ${config.instances}.`,
      ['instances'],
    );
  }
};

export const WHEN_DISK_PREVENTS_MULTIPLE_INSTANCES: RefinementOptions =
  DISK_PREVENTS_MULTIPLE_INSTANCES.guard;
