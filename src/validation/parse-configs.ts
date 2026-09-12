import type { AppliedDefault } from '../resources/defaults-provenance.js';
import { resourceDefaults, sourceRuntime, type BlueprintResource } from '../resources/resource.js';
import type { ValidationIssue } from './issue.js';
import { parseResource } from './parse-resource.js';
import { declaresUnparsedReplica } from './replica-names.js';
import { fieldsRead, translateSchemaIssue } from './translate-schema-issue.js';

export interface ParsedConfigs {
  readonly issues: readonly ValidationIssue[];
  readonly named: readonly BlueprintResource[];
  readonly accepted: readonly BlueprintResource[];
  readonly replicasKnown: boolean;
}

const reportedName = (resource: BlueprintResource): string => String(resource?.name);

const landedOn = (field: string, target: string): boolean =>
  field === target || field.startsWith(`${target}.`);

const fromScope = (
  issue: ValidationIssue,
  read: readonly string[],
  applied: readonly AppliedDefault[],
): ValidationIssue => {
  const entry = [issue.at.field, ...read]
    .map((field) => applied.find((candidate) => landedOn(field, candidate.field)))
    .find((candidate) => candidate !== undefined);

  return entry === undefined
    ? issue
    : {
        ...issue,
        message: `${issue.message} "${issue.at.resource}" takes "${entry.field}" from a defaults scope, so the value to change is the scope's.`,
      };
};

const fromReplicas = (issue: ValidationIssue, unparsed: boolean): ValidationIssue =>
  unparsed && landedOn(issue.at.field, 'readReplicas')
    ? {
        ...issue,
        message: `${issue.message} Until the read replicas of "${issue.at.resource}" parse, a reference to a database this blueprint does not list is not checked, since it may name one of them.`,
      }
    : issue;

export const parseConfigs = (resources: readonly BlueprintResource[]): ParsedConfigs => {
  const issues: ValidationIssue[] = [];
  const named: BlueprintResource[] = [];
  const accepted: BlueprintResource[] = [];
  let replicasKnown = true;

  for (const resource of resources) {
    const name = reportedName(resource);
    const { onEntry, onName, onConfig, onEnv } = parseResource(resource);

    if (onEntry.length > 0) {
      for (const issue of onEntry) issues.push(...translateSchemaIssue(name, [], issue));
      continue;
    }

    const runtime = sourceRuntime(resource);
    const applied = resourceDefaults(resource)?.applied ?? [];
    // A replica is addressed by its own name, so a database whose name did not parse still hides one.
    const unparsedReplicas = declaresUnparsedReplica(resource);
    if (unparsedReplicas) replicasKnown = false;

    for (const issue of onName) issues.push(...translateSchemaIssue(name, ['name'], issue));
    for (const issue of onConfig) {
      const read = fieldsRead(issue);
      issues.push(
        ...translateSchemaIssue(name, [], issue, runtime).map((entry) =>
          fromReplicas(fromScope(entry, read, applied), unparsedReplicas),
        ),
      );
    }
    for (const issue of onEnv) issues.push(...translateSchemaIssue(name, ['env'], issue));

    if (onName.length === 0) named.push(resource);
    if (onName.length === 0 && onConfig.length === 0 && onEnv.length === 0) accepted.push(resource);
  }

  return { issues, named, accepted, replicasKnown };
};
