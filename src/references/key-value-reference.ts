import type { ReferenceOrigin } from './reference-origin.js';
import type { ServiceReferenceValue } from './reference-value.js';
import { serviceProperty } from './service-target.js';

// spec §6.2: Render's prose documents connectionString alone for a Key Value instance.
export interface KeyValueReference {
  readonly connectionString: ServiceReferenceValue;
}

export const keyValueReference = (name: string, origin: ReferenceOrigin): KeyValueReference => ({
  connectionString: serviceProperty({ name, type: 'keyvalue', origin }, 'connectionString'),
});
