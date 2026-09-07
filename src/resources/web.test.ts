import { describe, expect, it } from 'vitest';

import { parseWebConfig, web, type WebConfig } from './web.js';

// SAFETY: JSON.parse returns any. Every config below stands in for a blueprint the CLI loaded
// through Node type stripping, which erases types without checking them, so the annotation is
// deliberately stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => WebConfig = JSON.parse;

const issueCodes = (config: WebConfig): readonly string[] => {
  const result = parseWebConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.code));
};

interface RaisedIssue {
  readonly validationCode: string;
  readonly path: readonly PropertyKey[];
}

const raisedIssues = (config: WebConfig): readonly RaisedIssue[] => {
  const result = parseWebConfig(config);
  if (result.success) return [];

  return result.error.issues.flatMap((issue): readonly RaisedIssue[] =>
    issue.code === 'custom'
      ? [{ validationCode: String(issue.params?.['validationCode']), path: issue.path }]
      : [],
  );
};

const DISK: WebConfig['disk'] = { name: 'uploads', mountPath: '/var/data' };

const SCALING: WebConfig['scaling'] = { minInstances: 1, maxInstances: 3, targetCPUPercent: 70 };

describe('web', () => {
  it('returns an inert value carrying the kind, the name, and the config', () => {
    const config: WebConfig = { runtime: 'node', buildCommand: 'pnpm build' };
    const service = web('api', config);

    expect(service.kind).toBe('web');
    expect(service.name).toBe('api');
    expect(service.config).toBe(config);
  });

  it('emits the name verbatim', () => {
    expect(web('Legacy API', { runtime: 'go' }).name).toBe('Legacy API');
  });

  it('exposes a handle that references its own name', () => {
    expect(web('api', { runtime: 'node' }).hostport).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      property: 'hostport',
    });
  });

  it('aliases a variable Render provides on itself', () => {
    expect(web('api', { runtime: 'node' }).renderVar('RENDER_EXTERNAL_HOSTNAME')).toEqual({
      reference: 'fromService',
      name: 'api',
      origin: 'blueprint',
      type: 'web',
      envVarKey: 'RENDER_EXTERNAL_HOSTNAME',
    });
  });

  it('resolves the callback form of env against its own handle', () => {
    const service = web('api', {
      runtime: 'node',
      env: (self) => ({ APP_HOST: self.renderVar('RENDER_EXTERNAL_HOSTNAME') }),
    });

    expect(service.config.env).toBeTypeOf('function');
    expect(service.hostport.name).toBe('api');
  });
});

describe('parseWebConfig', () => {
  it('accepts a config that fills every field of this slice', () => {
    expect(
      issueCodes({
        runtime: 'node',
        instances: 1,
        disk: { name: 'uploads', mountPath: '/var/data', sizeGB: 20 },
        domains: ['acme.dev'],
        buildFilter: { paths: ['apps/api/**'], ignoredPaths: ['**/*.md'] },
        previews: { generation: 'automatic', plan: 'starter', instances: 2 },
        maxShutdownDelaySeconds: 60,
      }),
    ).toEqual([]);
  });

  it('accepts autoscaling between two bounds with one target metric', () => {
    expect(issueCodes({ runtime: 'node', scaling: SCALING })).toEqual([]);
  });

  it('reports an inverted scaling range on the maxInstances field', () => {
    expect(
      raisedIssues({
        runtime: 'node',
        scaling: { minInstances: 3, maxInstances: 1, targetCPUPercent: 70 },
      }),
    ).toEqual([{ validationCode: 'ScalingRangeInverted', path: ['scaling', 'maxInstances'] }]);
  });

  it('reports autoscaling with neither target metric on the scaling field', () => {
    expect(
      raisedIssues({ runtime: 'node', scaling: { minInstances: 1, maxInstances: 3 } }),
    ).toEqual([{ validationCode: 'ScalingTargetMissing', path: ['scaling'] }]);
  });

  it('reports a scaling target above 90 as out of range', () => {
    expect(
      raisedIssues({
        runtime: 'node',
        scaling: { minInstances: 1, maxInstances: 3, targetMemoryPercent: 95 },
      }),
    ).toEqual([{ validationCode: 'OutOfRange', path: ['scaling', 'targetMemoryPercent'] }]);
  });

  it('reports an instance count below one as out of range', () => {
    expect(raisedIssues({ runtime: 'node', instances: 0 })).toEqual([
      { validationCode: 'OutOfRange', path: ['instances'] },
    ]);
  });

  it('reports a preview instance count below one as out of range', () => {
    expect(raisedIssues({ runtime: 'node', previews: { instances: 0 } })).toEqual([
      { validationCode: 'OutOfRange', path: ['previews', 'instances'] },
    ]);
  });

  it('reports a shutdown delay above 300 seconds as out of range', () => {
    expect(raisedIssues({ runtime: 'node', maxShutdownDelaySeconds: 400 })).toEqual([
      { validationCode: 'OutOfRange', path: ['maxShutdownDelaySeconds'] },
    ]);
  });

  it('reports a disk size below one GB as out of range', () => {
    expect(
      raisedIssues({
        runtime: 'node',
        disk: { name: 'uploads', mountPath: '/var/data', sizeGB: 0 },
      }),
    ).toEqual([{ validationCode: 'OutOfRange', path: ['disk', 'sizeGB'] }]);
  });

  it('accepts a disk size that is neither 1 nor a multiple of 5, which spec §8 bounds at 1', () => {
    expect(
      issueCodes({ runtime: 'node', disk: { name: 'uploads', mountPath: '/var/data', sizeGB: 7 } }),
    ).toEqual([]);
  });

  it('reports a disk mounted on a path Render reserves', () => {
    expect(
      raisedIssues({ runtime: 'node', disk: { name: 'uploads', mountPath: '/etc/secrets' } }),
    ).toEqual([{ validationCode: 'MountPathDisallowed', path: ['disk', 'mountPath'] }]);
  });

  it('reports a disk mounted on the repository root, the first path spec §4.4 names', () => {
    expect(raisedIssues({ runtime: 'node', disk: { name: 'uploads', mountPath: '/' } })).toEqual([
      { validationCode: 'MountPathDisallowed', path: ['disk', 'mountPath'] },
    ]);
  });

  it('accepts a directory under a reserved path, which spec §4.4 allows', () => {
    expect(
      issueCodes({
        runtime: 'node',
        disk: { name: 'uploads', mountPath: '/opt/render/project/src/uploads' },
      }),
    ).toEqual([]);
  });

  it('accepts a mount path no reserved path spells exactly', () => {
    expect(
      issueCodes({ runtime: 'node', disk: { name: 'uploads', mountPath: '/var/data' } }),
    ).toEqual([]);
  });

  it('accepts a relative mount path, because spec §4.4 bounds the paths and not their form', () => {
    expect(issueCodes({ runtime: 'node', disk: { name: 'uploads', mountPath: 'data' } })).toEqual(
      [],
    );
  });

  it('reports a disk beside autoscaling on the scaling field', () => {
    expect(raisedIssues({ runtime: 'node', disk: DISK, scaling: SCALING })).toEqual([
      { validationCode: 'DiskPreventsScaling', path: ['scaling'] },
    ]);
  });

  it('reports a disk beside more than one instance on the instances field', () => {
    expect(raisedIssues({ runtime: 'node', disk: DISK, instances: 2 })).toEqual([
      { validationCode: 'DiskPreventsScaling', path: ['instances'] },
    ]);
  });

  it('accepts a disk beside the single instance a disk allows', () => {
    expect(issueCodes({ runtime: 'node', disk: DISK, instances: 1 })).toEqual([]);
  });

  it('rejects a field the library does not model inside a disk', () => {
    expect(
      issueCodes(unchecked('{"runtime":"node","disk":{"name":"d","mountPath":"/d","label":"x"}}')),
    ).toEqual(['unrecognized_keys']);
  });

  it('rejects a field the library does not model inside scaling', () => {
    expect(
      issueCodes(
        unchecked(
          '{"runtime":"node","scaling":{"minInstances":1,"maxInstances":2,"targetCPUPercent":70,"targetRPS":10}}',
        ),
      ),
    ).toEqual(['unrecognized_keys']);
  });

  it('rejects a field the library does not model inside a build filter', () => {
    expect(issueCodes(unchecked('{"runtime":"node","buildFilter":{"globs":["a"]}}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('rejects a field the library does not model inside previews', () => {
    expect(issueCodes(unchecked('{"runtime":"node","previews":{"expireAfterDays":7}}'))).toEqual([
      'unrecognized_keys',
    ]);
  });

  it('accepts an ipAllowList in the entry form every kind that takes one shares', () => {
    expect(
      issueCodes({
        runtime: 'node',
        ipAllowList: [{ source: '203.0.113.4/30', description: 'office' }, { source: '::1' }],
      }),
    ).toEqual([]);
  });

  it('accepts an empty ipAllowList, which blocks every external connection', () => {
    expect(issueCodes({ runtime: 'node', ipAllowList: [] })).toEqual([]);
  });

  it('rejects a field the library does not model on an ipAllowList entry', () => {
    expect(
      issueCodes(unchecked('{"runtime":"node","ipAllowList":[{"source":"::1","label":"all"}]}')),
    ).toEqual(['unrecognized_keys']);
  });

  it('rejects an ipAllowList entry with no source', () => {
    expect(
      issueCodes(unchecked('{"runtime":"node","ipAllowList":[{"description":"office"}]}')),
    ).toEqual(['invalid_type']);
  });
});
