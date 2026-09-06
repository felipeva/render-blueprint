import { describe, expect, it } from 'vitest';

import { blueprint } from '../../blueprint/blueprint.js';
import { rootExtraFieldConflict } from './root-extra-field-conflict.js';

describe('rootExtraFieldConflict', () => {
  it('reports an escape-hatch key the library already emits at the root', () => {
    const issues = rootExtraFieldConflict(blueprint({ extraFields: { services: [] } }));

    expect(issues).toEqual([
      {
        code: 'ExtraFieldConflict',
        at: { resource: 'blueprint', field: 'extraFields.services' },
        message: expect.stringContaining('services'),
      },
    ]);
  });

  it('reports one issue per colliding key', () => {
    const issues = rootExtraFieldConflict(
      blueprint({ extraFields: { previews: {}, ungrouped: {} } }),
    );

    expect(issues.map((issue) => issue.at.field)).toEqual([
      'extraFields.previews',
      'extraFields.ungrouped',
    ]);
  });

  it('reports nothing for a root key the library does not model', () => {
    expect(rootExtraFieldConflict(blueprint({ extraFields: { version: '1' } }))).toEqual([]);
  });

  it('reports nothing for a blueprint with no escape hatch', () => {
    expect(rootExtraFieldConflict(blueprint({}))).toEqual([]);
  });
});
