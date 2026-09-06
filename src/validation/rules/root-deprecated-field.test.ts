import { describe, expect, it } from 'vitest';

import { blueprint } from '../../blueprint/blueprint.js';
import { rootDeprecatedField } from './root-deprecated-field.js';

describe('rootDeprecatedField', () => {
  it('reports a root escape-hatch key Render retired', () => {
    const issues = rootDeprecatedField(blueprint({ extraFields: { previewsEnabled: true } }));

    expect(issues).toEqual([
      {
        code: 'DeprecatedField',
        at: { resource: 'blueprint', field: 'extraFields.previewsEnabled' },
        message: expect.stringContaining('previews.generation'),
      },
    ]);
  });

  it('names the replacement for the retired expiry field', () => {
    const issues = rootDeprecatedField(blueprint({ extraFields: { previewsExpireAfterDays: 7 } }));

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('previews.expireAfterDays'),
    ]);
  });

  it('reports nothing for a key Render still accepts', () => {
    expect(rootDeprecatedField(blueprint({ extraFields: { version: '1' } }))).toEqual([]);
  });
});
