import * as z from 'zod';

import type { Equal, Expect } from '../equal.js';

const NAME_ERROR =
  'A registry credential reference names the credential the workspace holds, so the name is not empty.';

// spec §4.2: a registry credential is added in the Dashboard or through the API and is never
// defined in render.yaml, so the name is the whole of it and there is no property to reach for.
export interface RegistryCredentialReference {
  readonly fromRegistryCreds: {
    readonly name: string;
  };
}

const credentialSchema = z
  .strictObject(
    {
      fromRegistryCreds: z
        .strictObject({ name: z.string({ error: NAME_ERROR }).min(1, { error: NAME_ERROR }) })
        .readonly(),
    },
    {
      error:
        'A registry credential is the value external.registryCredential produced; this value is not one.',
    },
  )
  .readonly();

type CredentialSchemaMatchesInterface = Expect<
  Equal<z.infer<typeof credentialSchema>, RegistryCredentialReference>
>;

export const REGISTRY_CREDENTIAL_SCHEMA_MATCHES_INTERFACE: true =
  true satisfies CredentialSchemaMatchesInterface;

export const registryCredentialReferenceSchema: z.ZodType<RegistryCredentialReference> =
  credentialSchema;

export const registryCredentialReference = (name: string): RegistryCredentialReference => ({
  fromRegistryCreds: { name },
});
