import { describe, expect, it } from 'vitest';

import type { ServiceReferenceValue } from './reference-value.js';
import { serviceReferenceValueSchema } from './reference-value.js';

// SAFETY: JSON.parse returns any. Each value below stands in for one the CLI loaded through Node
// type stripping, which erases types without checking them, so the annotation is deliberately
// stronger than the value — the gap ADR-0003 gives the schemas to close.
const unchecked: (json: string) => ServiceReferenceValue = JSON.parse;

const accepts = (value: ServiceReferenceValue): boolean =>
  serviceReferenceValueSchema.safeParse(value).success;

describe('serviceReferenceValueSchema', () => {
  it('accepts a reference naming a property', () => {
    expect(
      accepts({
        reference: 'fromService',
        name: 'api',
        origin: 'blueprint',
        type: 'web',
        property: 'hostport',
      }),
    ).toBe(true);
  });

  it('accepts a reference naming an env var key', () => {
    expect(
      accepts({
        reference: 'fromService',
        name: 'api',
        origin: 'blueprint',
        type: 'web',
        envVarKey: 'PORT',
      }),
    ).toBe(true);
  });

  it('rejects a reference naming both, which Render’s own schema permits', () => {
    expect(
      accepts(
        unchecked(
          '{"reference":"fromService","name":"api","origin":"blueprint","type":"web","property":"host","envVarKey":"PORT"}',
        ),
      ),
    ).toBe(false);
  });

  it('rejects a reference naming neither', () => {
    expect(
      accepts(
        unchecked('{"reference":"fromService","name":"api","origin":"blueprint","type":"web"}'),
      ),
    ).toBe(false);
  });

  it('rejects a service type Render reserves for referencing it does not publish here', () => {
    expect(
      accepts(
        unchecked(
          '{"reference":"fromService","name":"legacy","origin":"blueprint","type":"job","envVarKey":"PORT"}',
        ),
      ),
    ).toBe(false);
  });
});
