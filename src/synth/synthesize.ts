import type { Result as ResultType } from "better-result";
import type { ToStringOptions } from "yaml";

import type { Blueprint } from "../blueprint/blueprint.js";
import type { BlueprintInvalid } from "../validation/blueprint-invalid.js";
import type { ValidationWarning } from "../validation/issue.js";
import { validate, type ValidatedBlueprint } from "../validation/validate.js";
import { document } from "./document.js";

export interface SynthesisReport {
  readonly yaml: string;
  readonly warnings: readonly ValidationWarning[];
}

const YAML_OPTIONS: ToStringOptions = { lineWidth: 0, indent: 2 };

const report = (value: ValidatedBlueprint): SynthesisReport => ({
  yaml: document(value).toString(YAML_OPTIONS),
  warnings: value.warnings,
});

export const synthesize = (value: Blueprint): ResultType<SynthesisReport, BlueprintInvalid> =>
  validate(value).map(report);
