import type { DatabaseProperty } from '../enums/database-property.js';
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

const property = (name: string, value: DatabaseProperty): DatabaseReferenceValue => ({
  reference: 'fromDatabase',
  name,
  property: value,
});

export const postgresReference = (name: string): PostgresReference => ({
  connectionString: property(name, 'connectionString'),
  connectionPoolString: property(name, 'connectionPoolString'),
  host: property(name, 'host'),
  port: property(name, 'port'),
  user: property(name, 'user'),
  password: property(name, 'password'),
  database: property(name, 'database'),
});
