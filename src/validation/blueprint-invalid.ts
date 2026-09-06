import { TaggedError, type TaggedErrorClass } from 'better-result';

import type { ValidationIssue } from './issue.js';

export type ValidationIssues = readonly [ValidationIssue, ...ValidationIssue[]];

const BlueprintInvalidBase: TaggedErrorClass<'BlueprintInvalid'> = TaggedError('BlueprintInvalid');

const describe = (issues: ValidationIssues): string =>
  issues.map((issue) => `  ${issue.at.resource}.${issue.at.field}: ${issue.message}`).join('\n');

export class BlueprintInvalid extends BlueprintInvalidBase<{
  readonly message: string;
  readonly issues: ValidationIssues;
}> {
  constructor(args: { readonly issues: ValidationIssues }) {
    super({
      ...args,
      message: `The blueprint has ${String(args.issues.length)} validation ${
        args.issues.length === 1 ? 'issue' : 'issues'
      }; nothing was synthesized.\n${describe(args.issues)}`,
    });
  }
}
