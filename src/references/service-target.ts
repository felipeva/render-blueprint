import type { ReferenceableServiceType } from '../enums/referenceable-service-type.js';
import type { ServiceProperty } from '../enums/service-property.js';
import type { ReferenceOrigin } from './reference-origin.js';
import type { ServiceReferenceValue } from './reference-value.js';

export interface ServiceTarget {
  readonly name: string;
  readonly type: ReferenceableServiceType;
  readonly origin: ReferenceOrigin;
}

export const serviceProperty = (
  target: ServiceTarget,
  property: ServiceProperty,
): ServiceReferenceValue => ({
  reference: 'fromService',
  name: target.name,
  origin: target.origin,
  type: target.type,
  property,
});

export const serviceEnvVar = (target: ServiceTarget, envVarKey: string): ServiceReferenceValue => ({
  reference: 'fromService',
  name: target.name,
  origin: target.origin,
  type: target.type,
  envVarKey,
});
