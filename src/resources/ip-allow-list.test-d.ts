import { describe, expectTypeOf, it } from 'vitest';

import { IP_ALLOW_LIST_SCHEMA_MATCHES_INTERFACE, type IpAllowList } from './ip-allow-list.js';

describe('IP_ALLOW_LIST_SCHEMA_MATCHES_INTERFACE', () => {
  it('is the literal true the guard produces', () => {
    expectTypeOf(IP_ALLOW_LIST_SCHEMA_MATCHES_INTERFACE).toEqualTypeOf<true>();
  });
});

describe('IpAllowList', () => {
  it('reads an entry as a source beside an optional description', () => {
    expectTypeOf<IpAllowList[number]>().toEqualTypeOf<{
      readonly source: string;
      readonly description?: string;
    }>();
  });
});
