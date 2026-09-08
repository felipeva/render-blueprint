import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

interface Diagnostic {
  readonly code: string;
  readonly filename: string;
  readonly help: string;
}

interface Report {
  readonly diagnostics: readonly Diagnostic[];
}

interface Placed {
  readonly path: string;
  readonly source: string;
}

const RESTRICTED = 'eslint(no-restricted-imports)';
const CYCLE = 'import(no-cycle)';
const CITATION = 'structure.md §3.1';

const root = fileURLToPath(new URL('..', import.meta.url));
const binary = join(root, 'node_modules', '.bin', 'oxlint');
const policy = join(root, '.oxlintrc.json');

const made: string[] = [];

const file = (path: string, source: string): Placed => ({ path, source });

const linted = (placed: readonly Placed[]): Report => {
  const directory = mkdtempSync(join(tmpdir(), 'render-blueprint-policy-'));
  made.push(directory);

  writeFileSync(join(directory, '.oxlintrc.json'), `${JSON.stringify({ extends: [policy] })}\n`);

  for (const entry of placed) {
    const target = join(directory, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.source);
  }

  const ran = spawnSync(binary, ['-f', 'json'], { cwd: directory, encoding: 'utf8' });

  // SAFETY: JSON.parse returns any. `oxlint -f json` writes one object to stdout carrying a
  // `diagnostics` array, and every assertion below reads only `code`, `filename` and `help` from
  // its entries; a run that produced no parsable report fails on the assertions rather than here.
  const report: Report = JSON.parse(ran.stdout);

  return report;
};

const raisedBy = (report: Report, path: string): readonly Diagnostic[] =>
  report.diagnostics.filter((entry) => entry.filename === path);

const codesOf = (report: Report, path: string): readonly string[] =>
  raisedBy(report, path).map((entry) => entry.code);

afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true });
});

describe('.oxlintrc.json', () => {
  it('rejects an import that runs upward through the tiers, in every form a specifier takes', () => {
    const report = linted([
      file('src/resources/web.ts', 'export const web = () => undefined;\n'),
      file(
        'src/references/runtime.ts',
        "import { web } from '../resources/web.js';\nexport const named = web;\n",
      ),
      file(
        'src/references/typed.ts',
        "import type { web } from '../resources/web.js';\nexport type Named = typeof web;\n",
      ),
      file(
        'src/references/namespaced.ts',
        "import type * as Resources from '../resources/web.js';\nexport type Whole = typeof Resources;\n",
      ),
      file('src/references/reexported.ts', "export { web } from '../resources/web.js';\n"),
      file(
        'src/references/deferred.ts',
        "export const load = () => import('../resources/web.js');\n",
      ),
    ]);

    expect(codesOf(report, 'src/references/runtime.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/references/typed.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/references/namespaced.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/references/reexported.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/references/deferred.ts')).toEqual([RESTRICTED]);
  });

  it('names the tier and cites the policy in every violation diagnostic', () => {
    const report = linted([
      file(
        'src/references/runtime.ts',
        "import { web } from '../resources/web.js';\nexport const named = web;\n",
      ),
    ]);

    const raised = raisedBy(report, 'src/references/runtime.ts');

    expect(raised).toHaveLength(1);
    expect(raised[0]?.help).toContain(CITATION);
    expect(raised[0]?.help).toContain('references/ is L2');
  });

  it('rejects an import between the two sibling modules of a tier', () => {
    const report = linted([
      file('src/defaults/with-defaults.ts', 'export const withDefaults = () => undefined;\n'),
      file(
        'src/blueprint/blueprint.ts',
        'export interface Blueprint {\n  readonly name: string;\n}\n',
      ),
      file(
        'src/defaults/reaches-sideways.ts',
        "import type { Blueprint } from '../blueprint/blueprint.js';\nexport type Copy = Blueprint;\n",
      ),
      file(
        'src/blueprint/reaches-sideways.ts',
        "import { withDefaults } from '../defaults/with-defaults.js';\nexport const wired = withDefaults;\n",
      ),
    ]);

    expect(codesOf(report, 'src/defaults/reaches-sideways.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/blueprint/reaches-sideways.ts')).toEqual([RESTRICTED]);
  });

  it('allows a module its own files and every tier below it', () => {
    const report = linted([
      file('src/raise.ts', 'export const raise = () => undefined;\n'),
      file('src/json.ts', "import { raise } from './raise.js';\nexport const isJson = raise;\n"),
      file(
        'src/enums/plan.ts',
        "import { raise } from '../raise.js';\nexport const PLANS = raise;\n",
      ),
      file(
        'src/references/external.ts',
        "import { PLANS } from '../enums/plan.js';\nexport const external = PLANS;\n",
      ),
      file(
        'src/env/secret.ts',
        "import { external } from '../references/external.js';\nexport const secret = external;\n",
      ),
      file('src/resources/neighbour.ts', 'export const neighbour = () => undefined;\n'),
      file(
        'src/resources/web.ts',
        [
          "import { neighbour } from './neighbour.js';",
          "import { isJson } from '../json.js';",
          "import { secret } from '../env/secret.js';",
          'export const web = [neighbour, isJson, secret];',
          '',
        ].join('\n'),
      ),
    ]);

    expect(report.diagnostics).toEqual([]);
  });

  it('rejects a rule that imports validate.ts or a sibling rule, and allows the rest of validation', () => {
    const report = linted([
      file('src/validation/validate.ts', 'export const validate = () => undefined;\n'),
      file('src/validation/issue.ts', 'export const issue = () => undefined;\n'),
      file('src/resources/web.ts', 'export const web = () => undefined;\n'),
      file(
        'src/validation/rules/web-only-field.ts',
        'export const webOnlyField = () => undefined;\n',
      ),
      file(
        'src/validation/rules/composes.ts',
        "import { validate } from '../validate.js';\nexport const composes = validate;\n",
      ),
      file(
        'src/validation/rules/borrows.ts',
        "import { webOnlyField } from './web-only-field.js';\nexport const borrows = webOnlyField;\n",
      ),
      file(
        'src/validation/rules/behaves.ts',
        [
          "import { issue } from '../issue.js';",
          "import { web } from '../../resources/web.js';",
          'export const behaves = [issue, web];',
          '',
        ].join('\n'),
      ),
    ]);

    expect(codesOf(report, 'src/validation/rules/composes.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/validation/rules/borrows.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/validation/rules/behaves.ts')).toEqual([]);
  });

  it('rejects an external dependency outside its documented owner', () => {
    const report = linted([
      file(
        'src/drift/normalize.ts',
        "import { parse } from 'yaml';\nexport const normalize = parse;\n",
      ),
      file('src/synth/document.ts', "import { z } from 'zod';\nexport const document = z;\n"),
      file(
        'src/synth/wiring.ts',
        "import { command } from '@drizzle-team/brocli';\nexport const wiring = command;\n",
      ),
      file(
        'src/validation/validate.ts',
        "import { readFile } from 'node:fs/promises';\nexport const validate = readFile;\n",
      ),
      file(
        'src/fs/node-file-port.ts',
        "import { tmpdir } from 'node:os';\nexport const temporary = tmpdir;\n",
      ),
      file(
        'src/resources/web.ts',
        "import { Result } from 'better-result';\nexport const web = Result;\n",
      ),
      file('src/cli/report.ts', "import { z } from 'zod';\nexport const report = z;\n"),
      file(
        'src/validation/oracle.test.ts',
        "import Ajv from 'ajv/dist/2020.js';\nexport const oracle = Ajv;\n",
      ),
    ]);

    expect(codesOf(report, 'src/drift/normalize.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/synth/document.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/synth/wiring.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/validation/validate.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/fs/node-file-port.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/resources/web.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/cli/report.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/validation/oracle.test.ts')).toEqual([RESTRICTED]);
  });

  it('allows each external dependency inside its documented owner', () => {
    const report = linted([
      file('src/index.ts', 'export const synthesize = () => undefined;\n'),
      file('src/resources/web.ts', "import { z } from 'zod';\nexport const web = z;\n"),
      file(
        'src/validation/validate.ts',
        "import { Result } from 'better-result';\nexport const validate = Result;\n",
      ),
      file(
        'src/synth/document.ts',
        "import { parse } from 'yaml';\nexport const document = parse;\n",
      ),
      file(
        'src/fs/node-file-port.ts',
        [
          "import { readFile } from 'node:fs/promises';",
          "import { join } from 'node:path';",
          'export const port = [readFile, join];',
          '',
        ].join('\n'),
      ),
      file(
        'src/cli/main.ts',
        [
          "import { command } from '@drizzle-team/brocli';",
          "import { fileURLToPath } from 'node:url';",
          "import { synthesize } from '../index.js';",
          'export const main = [command, fileURLToPath, synthesize];',
          '',
        ].join('\n'),
      ),
    ]);

    expect(report.diagnostics).toEqual([]);
  });

  it('rejects a cli file that reaches past index.ts and a src file that reaches into cli/', () => {
    const report = linted([
      file('src/index.ts', "export { runConfig } from './cli/run-config.js';\n"),
      file('src/testing.ts', "export { memoryFilePort } from './index.js';\n"),
      file('src/cli/run-config.ts', 'export const runConfig = () => undefined;\n'),
      file('src/synth/synthesize.ts', 'export const synthesize = () => undefined;\n'),
      file(
        'src/cli/execute.ts',
        "import { synthesize } from '../synth/synthesize.js';\nexport const execute = synthesize;\n",
      ),
      file(
        'src/drift/diff.ts',
        "import { runConfig } from '../cli/run-config.js';\nexport const diff = runConfig;\n",
      ),
    ]);

    expect(codesOf(report, 'src/index.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/testing.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/cli/execute.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/drift/diff.ts')).toEqual([RESTRICTED]);
  });

  it('rejects a cycle, including one expressed only through import type', () => {
    const report = linted([
      file(
        'src/env/literal.ts',
        "import type { Generated } from './generated.js';\nexport interface Literal {\n  readonly next: Generated | undefined;\n}\n",
      ),
      file(
        'src/env/generated.ts',
        "import type { Literal } from './literal.js';\nexport interface Generated {\n  readonly next: Literal | undefined;\n}\n",
      ),
      file(
        'src/drift/diff.ts',
        "import { normalize } from './normalize.js';\nexport const diff = normalize;\n",
      ),
      file(
        'src/drift/normalize.ts',
        "import { diff } from './diff.js';\nexport const normalize = diff;\n",
      ),
    ]);

    expect(codesOf(report, 'src/env/literal.ts')).toEqual([CYCLE]);
    expect(codesOf(report, 'src/env/generated.ts')).toEqual([CYCLE]);
    expect(codesOf(report, 'src/drift/diff.ts')).toEqual([CYCLE]);
    expect(codesOf(report, 'src/drift/normalize.ts')).toEqual([CYCLE]);
  });

  it('exempts a test file from the tier order and lets it reach test/support/', () => {
    const report = linted([
      file('test/support/raised-issues.ts', 'export const raisedIssues = () => undefined;\n'),
      file('src/fs/file-port.ts', 'export const filePort = () => undefined;\n'),
      file(
        'src/resources/web.test.ts',
        [
          "import { tmpdir } from 'node:os';",
          "import { expect } from 'vitest';",
          "import { filePort } from '../fs/file-port.js';",
          "import { raisedIssues } from '../../test/support/raised-issues.js';",
          'export const exercised = [tmpdir, expect, filePort, raisedIssues];',
          '',
        ].join('\n'),
      ),
    ]);

    expect(report.diagnostics).toEqual([]);
  });

  it('rejects a source file that imports a test file and a test file that imports a fixture', () => {
    const report = linted([
      file('test/fixtures/canonical/render.ts', 'export const render = () => undefined;\n'),
      file('src/resources/web.test.ts', 'export const helper = () => undefined;\n'),
      file(
        'src/resources/web.ts',
        "import { helper } from './web.test.js';\nexport const web = helper;\n",
      ),
      file(
        'src/synth/services.test.ts',
        "import { render } from '../../test/fixtures/canonical/render.js';\nexport const emitted = render;\n",
      ),
    ]);

    expect(codesOf(report, 'src/resources/web.ts')).toEqual([RESTRICTED]);
    expect(codesOf(report, 'src/synth/services.test.ts')).toEqual([RESTRICTED]);
  });

  it('rejects a directory that has no tier row rather than leaving it unrestricted', () => {
    const report = linted([
      file('src/resources/web.ts', 'export const web = () => undefined;\n'),
      file(
        'src/orchestration/pipeline.ts',
        [
          "import { parse } from 'yaml';",
          "import { web } from '../resources/web.js';",
          'export const pipeline = [parse, web];',
          '',
        ].join('\n'),
      ),
    ]);

    expect(codesOf(report, 'src/orchestration/pipeline.ts')).toEqual([RESTRICTED, RESTRICTED]);
    expect(raisedBy(report, 'src/orchestration/pipeline.ts')[0]?.help).toContain(
      'belongs to no tier',
    );
  });
});
