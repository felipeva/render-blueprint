import { httpServiceReference, type HttpServiceReference } from './http-service-reference.js';
import { keyValueReference, type KeyValueReference } from './key-value-reference.js';
import { opaqueServiceReference, type OpaqueServiceReference } from './opaque-service-reference.js';
import { postgresReference, type PostgresReference } from './postgres-reference.js';
import {
  registryCredentialReference,
  type RegistryCredentialReference,
} from './registry-credential-reference.js';

// An external handle carries no kind, so listing one in resources is a compile error, and its
// references never raise DanglingReference.
export interface ExternalReferences {
  readonly web: (name: string) => HttpServiceReference;
  readonly privateService: (name: string) => HttpServiceReference;
  readonly worker: (name: string) => OpaqueServiceReference;
  readonly cron: (name: string) => OpaqueServiceReference;
  readonly staticSite: (name: string) => OpaqueServiceReference;
  readonly keyValue: (name: string) => KeyValueReference;
  readonly postgres: (name: string) => PostgresReference;
  readonly registryCredential: (name: string) => RegistryCredentialReference;
}

export const external: ExternalReferences = {
  web: (name) => httpServiceReference({ name, type: 'web', origin: 'external' }),
  privateService: (name) => httpServiceReference({ name, type: 'pserv', origin: 'external' }),
  worker: (name) => opaqueServiceReference({ name, type: 'worker', origin: 'external' }),
  cron: (name) => opaqueServiceReference({ name, type: 'cron', origin: 'external' }),
  staticSite: (name) => opaqueServiceReference({ name, type: 'static', origin: 'external' }),
  keyValue: (name) => keyValueReference(name, 'external'),
  postgres: (name) => postgresReference(name, 'external'),
  // spec §4.2: a registry credential lives in the workspace and no blueprint declares one, so the
  // external handle is the only form there is.
  registryCredential: (name) => registryCredentialReference(name),
};
