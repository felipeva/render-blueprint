import { opaqueServiceReference, type OpaqueServiceReference } from './opaque-service-reference.js';
import type { ServiceReferenceValue } from './reference-value.js';
import { serviceProperty, type ServiceTarget } from './service-target.js';

// spec §6.2: a web service and a private service are the two kinds that answer on the private
// network, so they are the two that carry host, port and hostport.
export interface HttpServiceReference extends OpaqueServiceReference {
  readonly host: ServiceReferenceValue;
  readonly port: ServiceReferenceValue;
  readonly hostport: ServiceReferenceValue;
}

export const httpServiceReference = (target: ServiceTarget): HttpServiceReference => ({
  ...opaqueServiceReference(target),
  host: serviceProperty(target, 'host'),
  port: serviceProperty(target, 'port'),
  hostport: serviceProperty(target, 'hostport'),
});
