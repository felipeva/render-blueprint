import { describe, expectTypeOf, it } from 'vitest';

import type {
  AppliedDefault,
  DefaultField,
  DefaultKey,
  DefaultsDeclaration,
} from './defaults-provenance.js';

describe('DefaultKey', () => {
  it('names every default a scope can declare', () => {
    expectTypeOf<DefaultKey>().toEqualTypeOf<
      | 'region'
      | 'repo'
      | 'branch'
      | 'rootDir'
      | 'autoDeployTrigger'
      | 'buildFilter'
      | 'ipAllowList'
      | 'plan.web'
      | 'plan.privateService'
      | 'plan.worker'
      | 'plan.cron'
      | 'plan.keyValue'
      | 'plan.postgres'
    >();
  });
});

describe('DefaultField', () => {
  it('names the config field a default lands in', () => {
    expectTypeOf<DefaultField>().toEqualTypeOf<
      | 'region'
      | 'plan'
      | 'repo'
      | 'branch'
      | 'rootDir'
      | 'autoDeployTrigger'
      | 'buildFilter'
      | 'ipAllowList'
    >();
  });
});

describe('AppliedDefault', () => {
  it('carries the key, the field it filled and the scope that declared it', () => {
    expectTypeOf<AppliedDefault>().toEqualTypeOf<{
      readonly key: DefaultKey;
      readonly field: DefaultField;
      readonly scope: DefaultsDeclaration;
    }>();
  });
});
