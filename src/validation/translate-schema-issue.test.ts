import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { raise, readingFields } from '../raise.js';
import { parsePostgresConfig } from '../resources/postgres.js';
import { parseWebConfig } from '../resources/web.js';
import { fieldsRead } from './translate-schema-issue.js';

const planObject = (at: readonly PropertyKey[]) => {
  const rule = readingFields(['plan', 'enabled']);

  return z.strictObject({ plan: z.string(), enabled: z.boolean() }).superRefine((value, ctx) => {
    if (value.enabled) rule.raise(ctx, 'HighAvailabilityUnsupported', 'A fixture rule.', at);
  }, rule.guard);
};

describe('fieldsRead', () => {
  it('reads the fields a top-level refinement names as they are named', () => {
    const result = planObject(['enabled']).safeParse({ plan: 'free', enabled: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([['plan', 'enabled']]);
  });

  it('prefixes the fields a nested refinement names with the path of its object', () => {
    const result = z
      .strictObject({ previews: planObject(['enabled']) })
      .safeParse({ previews: { plan: 'free', enabled: true } });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['previews', 'enabled']]);
    expect(result.error.issues.map(fieldsRead)).toEqual([['previews.plan', 'previews.enabled']]);
  });

  it('prefixes the fields with the index of the array item the refinement sits on', () => {
    const result = z.strictObject({ replicas: z.array(planObject(['enabled'])) }).safeParse({
      replicas: [
        { plan: 'free', enabled: false },
        { plan: 'free', enabled: true },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([
      ['replicas.1.plan', 'replicas.1.enabled'],
    ]);
  });

  it('prefixes the fields of a nested refinement that reports on its own object', () => {
    const result = z
      .strictObject({ previews: planObject([]) })
      .safeParse({ previews: { plan: 'free', enabled: true } });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['previews']]);
    expect(result.error.issues.map(fieldsRead)).toEqual([['previews.plan', 'previews.enabled']]);
  });

  it('reads no fields off an issue raised without them', () => {
    const result = z
      .string()
      .superRefine((_value, ctx) => raise(ctx, 'OutOfRange', 'A fixture rule.', []))
      .safeParse('free');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([[]]);
  });

  it('reads no fields off a type failure', () => {
    const result = planObject(['enabled']).safeParse({ plan: 1, enabled: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([[]]);
  });

  it('prefixes the fields the scaling range rule reads with the scaling path', () => {
    const result = parseWebConfig({
      runtime: 'node',
      scaling: { minInstances: 3, maxInstances: 2, targetCPUPercent: 60 },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['scaling', 'maxInstances']]);
    expect(result.error.issues.map(fieldsRead)).toEqual([
      ['scaling.minInstances', 'scaling.maxInstances'],
    ]);
  });

  it('prefixes the fields the scaling target rule reads with the scaling path it reports at', () => {
    const result = parseWebConfig({
      runtime: 'node',
      scaling: { minInstances: 1, maxInstances: 2 },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['scaling']]);
    expect(result.error.issues.map(fieldsRead)).toEqual([
      ['scaling.targetCPUPercent', 'scaling.targetMemoryPercent'],
    ]);
  });

  it('reads the fields both high-availability rules name on a database', () => {
    const result = parsePostgresConfig({
      plan: 'free',
      postgresMajorVersion: '12',
      highAvailability: { enabled: true },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([
      ['highAvailability', 'postgresMajorVersion'],
      ['highAvailability', 'plan'],
    ]);
  });

  it('leaves out the runtime the disk and subdomain rules need parsed but do not read', () => {
    const result = parseWebConfig({
      runtime: 'node',
      disk: { name: 'uploads', mountPath: '/var/data' },
      instances: 2,
      scaling: { minInstances: 1, maxInstances: 2, targetCPUPercent: 60 },
      renderSubdomainPolicy: 'disabled',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(fieldsRead)).toEqual([
      ['disk', 'scaling'],
      ['disk', 'instances'],
      ['renderSubdomainPolicy', 'domains'],
    ]);
  });
});
