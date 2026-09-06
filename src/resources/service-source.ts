import * as z from 'zod';

import { nativeRuntimeSchema, type NativeRuntime } from '../enums/runtime.js';
import type { Equal, Expect } from '../equal.js';
import {
  registryCredentialReferenceSchema,
  type RegistryCredentialReference,
} from '../references/registry-credential-reference.js';
import { optionalCommonServiceFields } from './service-fields.js';

// spec §4.3: the digest or tag lives inside the url, and a private image needs the credential the
// workspace holds.
export interface ServiceImage {
  readonly url: string;
  readonly creds?: RegistryCredentialReference;
}

// Emission order follows the schema's image property order.
export const SERVICE_IMAGE_FIELDS = ['url', 'creds'] as const;

// spec §3.2 and §4.1: a native runtime builds from the repository, so Render runs the build and
// start commands the author wrote.
export interface NativeSource {
  readonly runtime: NativeRuntime;
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly buildCommand?: string;
}

// spec §4.2: the Dockerfile is the build, so there is no buildCommand to run beside it.
export interface DockerSource {
  readonly runtime: 'docker';
  readonly repo?: string;
  readonly branch?: string;
  readonly rootDir?: string;
  readonly dockerfilePath?: string;
  readonly dockerContext?: string;
  readonly dockerCommand?: string;
}

// spec §4.3: image and repo are the two alternative sources, so a prebuilt image names no
// repository, no branch and no directory inside one. dockerCommand overrides the CMD the image
// carries, which is the one command there is to give it.
export interface ImageSource {
  readonly runtime: 'image';
  readonly image: ServiceImage;
  readonly dockerCommand?: string;
}

export type ServiceSource = NativeSource | DockerSource | ImageSource;

const imageSchema = z
  .strictObject({
    url: z.string(),
    creds: registryCredentialReferenceSchema.exactOptional(),
  })
  .readonly();

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
}

export const dockerSourceFields: DockerSourceFields = {
  runtime: z.literal('docker'),
  repo: optionalCommonServiceFields.repo,
  branch: optionalCommonServiceFields.branch,
  rootDir: optionalCommonServiceFields.rootDir,
  dockerfilePath: z.string().exactOptional(),
  dockerContext: z.string().exactOptional(),
  dockerCommand: z.string().exactOptional(),
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

// Every key the three branches own between them. A key here on a config whose runtime picked
// another branch names the wrong source rather than a field the library does not model, and
// service-source.test.ts holds this tuple to the field maps above.
export const SOURCE_FIELDS = [
  'repo',
  'branch',
  'rootDir',
  'buildCommand',
  'dockerfilePath',
  'dockerContext',
  'dockerCommand',
  'image',
] as const;

// The discriminator carries its own message, which names every runtime the three branches accept;
// a branch of its own would say less than that list does.
const sourceSchema = z.discriminatedUnion('runtime', [
  z.strictObject(nativeSourceFields).readonly(),
  z.strictObject(dockerSourceFields).readonly(),
  z.strictObject(imageSourceFields).readonly(),
]);

type SourceSchemaMatchesInterface = Expect<Equal<z.infer<typeof sourceSchema>, ServiceSource>>;

export const SERVICE_SOURCE_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies SourceSchemaMatchesInterface;

// spec §4.2 and §4.3: Render builds a Dockerfile with the commands inside it and does not build a
// prebuilt image at all, so a build or start command is only missing from a native source.
export const nativeSource = (source: ServiceSource): NativeSource | undefined =>
  source.runtime === 'docker' || source.runtime === 'image' ? undefined : source;

export type RepoSource = NativeSource | DockerSource;

// spec §4.3: image and repo are the two alternative sources, so only the other two name a
// repository, a branch and a directory inside it.
export const repoSource = (source: ServiceSource): RepoSource | undefined =>
  source.runtime === 'image' ? undefined : source;
