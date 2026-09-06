import type { DatabaseProperty } from '../enums/database-property.js';
import type { ReferenceOrigin } from './reference-origin.js';
import type { DatabaseReferenceValue } from './reference-value.js';

export interface PostgresReference {
  readonly connectionString: DatabaseReferenceValue;
  readonly connectionPoolString: DatabaseReferenceValue;
  readonly host: DatabaseReferenceValue;
  readonly port: DatabaseReferenceValue;
  readonly user: DatabaseReferenceValue;
  readonly password: DatabaseReferenceValue;
  readonly database: DatabaseReferenceValue;
}

const property = (
  name: string,
  origin: ReferenceOrigin,
  value: DatabaseProperty,
): DatabaseReferenceValue => ({
  reference: 'fromDatabase',
  name,
  origin,
  property: value,
});

export const postgresReference = (name: string, origin: ReferenceOrigin): PostgresReference => ({
  connectionString: property(name, origin, 'connectionString'),
  connectionPoolString: property(name, origin, 'connectionPoolString'),
  host: property(name, origin, 'host'),
  port: property(name, origin, 'port'),
  user: property(name, origin, 'user'),
  password: property(name, origin, 'password'),
  database: property(name, origin, 'database'),
});
