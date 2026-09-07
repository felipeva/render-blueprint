import * as z from 'zod';

import { nativeRuntimeSchema, type NativeRuntime } from '../enums/runtime.js';
import type { Equal, Expect } from '../equal.js';
import {
  registryCredentialReferenceSchema,
  type RegistryCredentialReference,
} from '../references/registry-credential-reference.js';
import { optionalCommonServiceFields } from './service-fields.js';

// spec §4.3: the digest or tag lives inside the url.
export interface ServiceImage {
  readonly url: string;
  readonly creds?: RegistryCredentialReference;
}

// Emission order follows the schema's image property order.
export const SERVICE_IMAGE_FIELDS = ['url', 'creds'] as const;

// spec §3.2 and §4.1: a native runtime builds from the repository.
export interface NativeSource {
  readonly runtime: NativeRuntime;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly buildCommand?: string;
}

// spec §4.2: the Dockerfile is the build.
export interface DockerSource {
  readonly runtime: 'docker';
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly dockerfilePath?: string;
  readonly dockerContext?: string;
  readonly dockerCommand?: string;
  readonly registryCredential?: RegistryCredentialReference;
}

// spec §4.3: image and repo are the two alternative sources.
export interface ImageSource {
  readonly runtime: 'image';
  readonly image: ServiceImage;
  readonly dockerCommand?: string;
}

export type ServiceSource = NativeSource | DockerSource | ImageSource;

const URL_ERROR =
  'A prebuilt image is named by its url, tag or digest included, so the url is not empty.';

const imageSchema = z
  .strictObject({
    url: z.string({ error: URL_ERROR }).min(1, { error: URL_ERROR }),
    creds: registryCredentialReferenceSchema.exactOptional(),
  })
  .readonly();

type ImageSchemaMatchesInterface = Expect<Equal<z.infer<typeof imageSchema>, ServiceImage>>;

export const SERVICE_IMAGE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies ImageSchemaMatchesInterface;

export interface NativeSourceFields {
  readonly runtime: z.ZodEnum<z.core.util.ToEnum<NativeRuntime>>;
  readonly repo: z.ZodExactOptional<z.ZodString>;
  readonly branch: z.ZodExactOptional<z.ZodString>;
  readonly rootDir: z.ZodExactOptional<z.ZodString>;
  readonly buildCommand: z.ZodExactOptional<z.ZodString>;
}

export const nativeSourceFields: NativeSourceFields = {
  runtime: nativeRuntimeSchema,
  repo: optionalCommonServiceFields.repo,
  branch: optionalCommonServiceFields.branch,
  rootDir: optionalCommonServiceFields.rootDir,
  buildCommand: optionalCommonServiceFields.buildCommand,
};

export interface DockerSourceFields {
  readonly runtime: z.ZodLiteral<'docker'>;
  readonly repo: z.ZodExactOptional<z.ZodString>;
  readonly branch: z.ZodExactOptional<z.ZodString>;
  readonly rootDir: z.ZodExactOptional<z.ZodString>;
  readonly dockerfilePath: z.ZodExactOptional<z.ZodString>;
  readonly dockerContext: z.ZodExactOptional<z.ZodString>;
  readonly dockerCommand: z.ZodExactOptional<z.ZodString>;
  readonly registryCredential: z.ZodExactOptional<z.ZodType<RegistryCredentialReference>>;
}

export const dockerSourceFields: DockerSourceFields = {
  runtime: z.literal('docker'),
  repo: optionalCommonServiceFields.repo,
  branch: optionalCommonServiceFields.branch,
  rootDir: optionalCommonServiceFields.rootDir,
  dockerfilePath: z.string().exactOptional(),
  dockerContext: z.string().exactOptional(),
  dockerCommand: z.string().exactOptional(),
  registryCredential: registryCredentialReferenceSchema.exactOptional(),
};

export interface ImageSourceFields {
  readonly runtime: z.ZodLiteral<'image'>;
  readonly image: z.ZodType<ServiceImage>;
  readonly dockerCommand: z.ZodExactOptional<z.ZodString>;
}

export const imageSourceFields: ImageSourceFields = {
  runtime: z.literal('image'),
  image: imageSchema,
  dockerCommand: z.string().exactOptional(),
};

const notTheDiscriminator = (key: string): boolean => key !== 'runtime';

export const SOURCE_FIELDS = [
  'repo',
  'branch',
  'rootDir',
  'buildCommand',
  'dockerfilePath',
  'dockerContext',
  'dockerCommand',
  'registryCredential',
  'image',
] as const;

const sourceSchema = z.discriminatedUnion('runtime', [
  z.strictObject(nativeSourceFields).readonly(),
  z.strictObject(dockerSourceFields).readonly(),
  z.strictObject(imageSourceFields).readonly(),
]);

type SourceSchemaMatchesInterface = Expect<Equal<z.infer<typeof sourceSchema>, ServiceSource>>;

export const SERVICE_SOURCE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies SourceSchemaMatchesInterface;

export const ownedSourceFields = (runtime: string): readonly string[] => {
  if (runtime === 'image') return Object.keys(imageSourceFields).filter(notTheDiscriminator);
  if (runtime === 'docker') return Object.keys(dockerSourceFields).filter(notTheDiscriminator);
  return Object.keys(nativeSourceFields).filter(notTheDiscriminator);
};

// spec §4.2 and §4.3: Render builds a Dockerfile with the commands inside it and does not build a
// prebuilt image at all.
export const nativeSource = (source: ServiceSource): NativeSource | undefined =>
  source.runtime === 'docker' || source.runtime === 'image' ? undefined : source;

export type RepoSource = NativeSource | DockerSource;

// spec §4.3: image and repo are the two alternative sources.
export const repoSource = (source: ServiceSource): RepoSource | undefined =>
  source.runtime === 'image' ? undefined : source;
