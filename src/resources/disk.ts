import * as z from 'zod';

import { boundedInteger } from '../bounded-integer.js';
import type { Equal, Expect } from '../equal.js';
import { raise } from '../raise.js';
import type { Scaling } from './scaling.js';

// spec §4.4: a disk needs a name and a mount path; sizeGB defaults to 10 and Render only ever
// grows it. spec §8 bounds it at 1 GB and leaves the multiple-of-five rule to a database.
export interface Disk {
  readonly name: string;
  readonly mountPath: string;
  readonly sizeGB?: number;
}

// Emission order follows the schema's disk property order.
export const DISK_FIELDS = ['name', 'mountPath', 'sizeGB'] as const;

// spec §4.4: the nine paths Render refuses to mount a disk on. The list is of exact paths, so a
// directory under one of them is allowed and nothing here reads a prefix.
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
  .superRefine((value, ctx) => {
    if (DISALLOWED_MOUNT_PATHS.has(value.mountPath)) {
      raise(
        ctx,
        'MountPathDisallowed',
        `Render reserves "${value.mountPath}" and mounts no disk there; a directory under it is allowed.`,
        ['mountPath'],
      );
    }
  });

type DiskSchemaMatchesInterface = Expect<Equal<z.infer<typeof diskObject>, Disk>>;

export const DISK_SCHEMA_MATCHES_INTERFACE: true = true satisfies DiskSchemaMatchesInterface;

export const diskSchema: z.ZodType<Disk> = diskObject;

export interface ScalableFields {
  readonly disk?: Disk;
  readonly instances?: number;
  readonly scaling?: Scaling;
}

// spec §4.4: a service with an attached disk cannot run on more than one instance, so a disk
// beside autoscaling or beside a count above one is a pair Render cannot honour.
export const raiseDiskPreventsScaling = <T extends ScalableFields>(
  config: T,
  ctx: z.core.$RefinementCtx<T>,
): void => {
  if (config.disk === undefined) return;

  if (config.scaling !== undefined) {
    raise(
      ctx,
      'DiskPreventsScaling',
      'A service with a disk runs on one instance, so Render cannot autoscale it; drop the disk or drop scaling.',
      ['scaling'],
    );
  }

  if (config.instances !== undefined && config.instances > 1) {
    raise(
      ctx,
      'DiskPreventsScaling',
      `A service with a disk runs on one instance, and this one asks for ${config.instances}.`,
      ['instances'],
    );
  }
};
