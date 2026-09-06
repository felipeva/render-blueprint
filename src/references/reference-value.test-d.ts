import { describe, expectTypeOf, it } from 'vitest';

import {
  DATABASE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE,
  SERVICE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE,
  type ServiceReferenceValue,
} from './reference-value.js';

describe('ServiceReferenceValue', () => {
  it('rejects a value carrying neither a property nor an env var key', () => {
    // @ts-expect-error a fromService reference names one of the two.
    const neither: ServiceReferenceValue = {
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
    };

    expectTypeOf(neither).toEqualTypeOf<ServiceReferenceValue>();
  });
});

describe('DATABASE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(DATABASE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('SERVICE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(SERVICE_REFERENCE_VALUE_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
