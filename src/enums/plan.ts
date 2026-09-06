import * as z from 'zod';

export const SERVER_PLANS = [
  'free',
  'starter',
  'standard',
  'pro',
  'pro plus',
  'pro max',
  'pro ultra',
  '0.5c-512mb',
  '1c-2g',
  '2c-4g',
  '2c-8g',
  '2c-16g',
  '4c-8g',
  '4c-16g',
  '4c-32g',
  '8c-16g',
  '8c-32g',
  '8c-64g',
  '12c-24g',
  '12c-48g',
  '12c-96g',
] as const;

export type ServerPlan = (typeof SERVER_PLANS)[number];

export const serverPlanSchema: z.ZodEnum<z.core.util.ToEnum<ServerPlan>> = z.enum(SERVER_PLANS);

// spec §8.1: the free instance type is offered to web services and static sites; the [SPEC] table
// for private services and background workers is the serverPlan list without it.
export const WORKER_PLANS = [
  'starter',
  'standard',
  'pro',
  'pro plus',
  'pro max',
  'pro ultra',
  '0.5c-512mb',
  '1c-2g',
  '2c-4g',
  '2c-8g',
  '2c-16g',
  '4c-8g',
  '4c-16g',
  '4c-32g',
  '8c-16g',
  '8c-32g',
  '8c-64g',
  '12c-24g',
  '12c-48g',
  '12c-96g',
] as const;

export type WorkerPlan = (typeof WORKER_PLANS)[number];

export const workerPlanSchema: z.ZodEnum<z.core.util.ToEnum<WorkerPlan>> = z.enum(WORKER_PLANS);

export const CRON_PLANS = [
  'starter',
  'standard',
  'pro',
  'pro plus',
  '0.5c-512mb',
  '1c-2g',
  '2c-4g',
  '2c-8g',
  '2c-16g',
  '4c-8g',
  '4c-16g',
  '4c-32g',
  '8c-16g',
  '8c-32g',
  '8c-64g',
] as const;

export type CronPlan = (typeof CRON_PLANS)[number];

export const cronPlanSchema: z.ZodEnum<z.core.util.ToEnum<CronPlan>> = z.enum(CRON_PLANS);

export const POSTGRES_PLANS = [
  'free',
  'starter',
  'standard',
  'pro',
  'pro plus',
  'basic-256mb',
  'basic-1gb',
  'basic-4gb',
  'pro-4gb',
  'pro-8gb',
  'pro-16gb',
  'pro-32gb',
  'pro-64gb',
  'pro-128gb',
  'pro-192gb',
  'pro-256gb',
  'pro-384gb',
  'pro-512gb',
  'accelerated-16gb',
  'accelerated-32gb',
  'accelerated-64gb',
  'accelerated-128gb',
  'accelerated-256gb',
  'accelerated-384gb',
  'accelerated-512gb',
  'accelerated-768gb',
  'accelerated-1024gb',
  '0.1c-256mb',
  '0.5c-1g',
  '1c-2g',
  '1c-4g',
  '2c-4g',
  '2c-8g',
  '2c-16g',
  '4c-16g',
  '4c-32g',
  '8c-32g',
  '8c-64g',
  '16c-64g',
  '16c-128g',
  '32c-128g',
  '32c-256g',
  '48c-192g',
  '48c-384g',
  '64c-256g',
  '64c-512g',
  '96c-384g',
  '96c-768g',
  '128c-512g',
  '128c-1024g',
] as const;

export type PostgresPlan = (typeof POSTGRES_PLANS)[number];

export const postgresPlanSchema: z.ZodEnum<z.core.util.ToEnum<PostgresPlan>> =
  z.enum(POSTGRES_PLANS);

export const KEY_VALUE_PLANS = [
  'free',
  'starter',
  'standard',
  'pro',
  'pro plus',
  'pro max',
  'pro ultra',
  '256mb',
  '1g',
  '5g',
  '10g',
  '20g',
  '40g',
] as const;

export type KeyValuePlan = (typeof KEY_VALUE_PLANS)[number];

export const keyValuePlanSchema: z.ZodEnum<z.core.util.ToEnum<KeyValuePlan>> =
  z.enum(KEY_VALUE_PLANS);
