import { describe, expect, it } from 'vitest';

import { normalize } from './normalize.js';

describe('normalize', () => {
  it('orders mapping keys so a reordered file normalizes to the same lines', () => {
    const one = normalize('name: api\ntype: web\n');
    const other = normalize('type: web\nname: api\n');

    expect(one.lines).toEqual(other.lines);
  });

  it('drops comments, blank lines and quoting differences', () => {
    const one = normalize('# a banner\n\nname: "api"\n');
    const other = normalize("name: 'api'\n");

    expect(one.lines).toEqual(['name: api']);
    expect(other.lines).toEqual(['name: api']);
  });

  it('reads flow style and block style as the same document', () => {
    const one = normalize('services: [{ name: api }]\n');
    const other = normalize('services:\n  - name: api\n');

    expect(one.lines).toEqual(other.lines);
  });

  it('keeps the order of a sequence, which YAML does not treat as a set', () => {
    const one = normalize('services:\n  - name: api\n  - name: web\n');
    const other = normalize('services:\n  - name: web\n  - name: api\n');

    expect(one.lines).not.toEqual(other.lines);
  });

  it('carries the parsed document so the drift report can classify it', () => {
    expect(normalize('services:\n  - name: api\n').value).toEqual({ services: [{ name: 'api' }] });
  });

  it('falls back to the raw lines when the text is not YAML', () => {
    const broken = normalize('services: [\n  - : :\n');

    expect(broken.value).toBeUndefined();
    expect(broken.lines).toEqual(['services: [', '  - : :']);
  });
});
