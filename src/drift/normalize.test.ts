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
    const parsed = normalize('services:\n  - name: api\n');

    expect(parsed.status).toBe('parsed');
    if (parsed.status !== 'parsed') return;
    expect(parsed.value).toEqual({ services: [{ name: 'api' }] });
  });

  it('reports a duplicated key as malformed rather than parsing it', () => {
    const malformed = normalize('services:\n  - name: api\n    name: web\n');

    expect(malformed.status).toBe('malformed');
    if (malformed.status !== 'malformed') return;
    expect(malformed.errors).toEqual(['Map keys must be unique at line 3, column 5:']);
  });

  it('keeps the raw lines of a document it could not parse', () => {
    const malformed = normalize('services: [\n  - : :\n');

    expect(malformed.status).toBe('malformed');
    if (malformed.status !== 'malformed') return;
    expect(malformed.lines).toEqual(['services: [', '  - : :']);
    expect(malformed.errors.length).toBeGreaterThan(0);
  });

  it('refuses a document that declares a YAML version it does not read', () => {
    const malformed = normalize('%YAML 1.1\n---\nname: api\n');

    expect(malformed.status).toBe('malformed');
    if (malformed.status !== 'malformed') return;
    expect(malformed.errors).toEqual(['The document declares %YAML 1.1; only 1.2 is read.']);
  });
});
