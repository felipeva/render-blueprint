import { describe, expectTypeOf, it } from 'vitest';

import type { ServiceRuntime } from '../enums/runtime.js';
import { SERVICE_SOURCE_SCHEMA_MATCHES_INTERFACE, type ServiceSource } from './service-source.js';

describe('ServiceSource', () => {
  it('covers every runtime a service picks a source with', () => {
    expectTypeOf<ServiceSource['runtime']>().toEqualTypeOf<ServiceRuntime>();
  });
});

describe('SERVICE_SOURCE_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(SERVICE_SOURCE_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});
