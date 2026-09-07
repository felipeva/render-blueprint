import type { RenderProvidedKey } from '../enums/render-provided-key.js';
import type { ServiceReferenceValue } from './reference-value.js';
import { serviceEnvVar, type ServiceTarget } from './service-target.js';

// spec §6.2: host, port and hostport belong to web and private services.
export interface OpaqueServiceReference {
  readonly envVar: (key: string) => ServiceReferenceValue;
  readonly renderVar: (name: RenderProvidedKey) => ServiceReferenceValue;
}

export const opaqueServiceReference = (target: ServiceTarget): OpaqueServiceReference => ({
  envVar: (key) => serviceEnvVar(target, key),
  renderVar: (name) => serviceEnvVar(target, name),
});
