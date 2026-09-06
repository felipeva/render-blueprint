import { describe, it } from 'vitest';

import { blueprint } from '../blueprint/blueprint.js';
import { web } from '../resources/web.js';
import { external } from './external.js';

describe('external', () => {
  it('rejects a handle in the resource list, because it carries no kind', () => {
    // @ts-expect-error an external handle is referenceable but is not a BlueprintResource.
    blueprint({ resources: [external.privateService('legacy-auth')] });
  });

  it('rejects an external database in the resource list', () => {
    // @ts-expect-error an external handle names a resource this blueprint does not manage.
    blueprint({ resources: [external.postgres('legacy-db')] });
  });

  it('rejects the host property on a worker handle', () => {
    // @ts-expect-error spec §6.2: host belongs to web and private services alone.
    web('api', { runtime: 'node', env: { JOBS_HOST: external.worker('jobs').host } });
  });

  it('takes a reference to a resource outside this blueprint', () => {
    web('api', {
      runtime: 'node',
      env: {
        AUTH_HOSTPORT: external.privateService('legacy-auth').hostport,
        LEGACY_URL: external.postgres('legacy-db').connectionString,
        SHARED_CACHE: external.keyValue('shared-cache').connectionString,
      },
    });
  });
});
