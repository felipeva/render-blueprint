import type { ReferenceOrigin } from './reference-origin.js';
import type { ServiceReferenceValue } from './reference-value.js';
import { serviceProperty } from './service-target.js';

// spec §6.2: Render's prose documents connectionString alone for a Key Value instance. The schema
// permits host and port on any fromService reference; design B §9.3 drops them as the safer read.
export interface KeyValueReference {
  readonly connectionString: ServiceReferenceValue;
}

export const keyValueReference = (name: string, origin: ReferenceOrigin): KeyValueReference => ({
  connectionString: serviceProperty({ name, type: 'keyvalue', origin }, 'connectionString'),
});
