import { YAMLMap } from 'yaml';

import type { ServiceRuntime } from '../enums/runtime.js';
import type { RegistryCredentialReference } from '../references/registry-credential-reference.js';
import {
  SERVICE_IMAGE_FIELDS,
  type ServiceImage,
  type ServiceSource,
} from '../resources/service-source.js';
import { FROM_REGISTRY_CREDS_KEY_ORDER, REGISTRY_CREDENTIAL_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';

// spec §12 makes an omitted key "retain current" rather than "clear".
export interface SourceValues {
  readonly runtime: ServiceRuntime;
  readonly repo: string | undefined;
  readonly branch: string | undefined;
  readonly image: YAMLMap | undefined;
  readonly rootDir: string | undefined;
  readonly dockerCommand: string | undefined;
  readonly dockerContext: string | undefined;
  readonly dockerfilePath: string | undefined;
  readonly registryCredential: YAMLMap | undefined;
  readonly buildCommand: string | undefined;
}

const registryCredential = (creds: RegistryCredentialReference): YAMLMap =>
  mapping(
    REGISTRY_CREDENTIAL_KEY_ORDER,
    {
      fromRegistryCreds: mapping(
        FROM_REGISTRY_CREDS_KEY_ORDER,
        { name: creds.fromRegistryCreds.name },
        undefined,
      ),
    },
    undefined,
  );

const image = (value: ServiceImage): YAMLMap =>
  mapping(
    SERVICE_IMAGE_FIELDS,
    {
      url: value.url,
      creds: value.creds === undefined ? undefined : registryCredential(value.creds),
    },
    undefined,
  );

export const sourceValues = (source: ServiceSource): SourceValues => {
  if (source.runtime === 'image') {
    return {
      runtime: 'image',
      repo: undefined,
      branch: undefined,
      image: image(source.image),
      rootDir: undefined,
      dockerCommand: source.dockerCommand,
      dockerContext: undefined,
      dockerfilePath: undefined,
      registryCredential: undefined,
      buildCommand: undefined,
    };
  }

  if (source.runtime === 'docker') {
    return {
      runtime: 'docker',
      repo: source.repo,
      branch: source.branch,
      image: undefined,
      rootDir: source.rootDir,
      dockerCommand: source.dockerCommand,
      dockerContext: source.dockerContext,
      dockerfilePath: source.dockerfilePath,
      registryCredential:
        source.registryCredential === undefined
          ? undefined
          : registryCredential(source.registryCredential),
      buildCommand: undefined,
    };
  }

  return {
    runtime: source.runtime,
    repo: source.repo,
    branch: source.branch,
    image: undefined,
    rootDir: source.rootDir,
    dockerCommand: undefined,
    dockerContext: undefined,
    dockerfilePath: undefined,
    registryCredential: undefined,
    buildCommand: source.buildCommand,
  };
};
