import { parseBlueprint, ROOT_NAME, type Blueprint } from '../blueprint/blueprint.js';
import { parseEnvironment } from '../blueprint/environment.js';
import { parseProject } from '../blueprint/project.js';
import type { ValidationIssue } from './issue.js';
import { translate } from './parse-configs.js';

export const parsePlacement = (value: Blueprint): readonly ValidationIssue[] => {
  const onRoot = parseBlueprint(value);
  if (!onRoot.success) {
    return onRoot.error.issues.flatMap((issue) => translate(ROOT_NAME, [], issue));
  }

  const issues: ValidationIssue[] = [];

  for (const entry of value.projects) {
    const projectName = String(entry?.name);
    const onProject = parseProject(entry);

    if (!onProject.success) {
      for (const issue of onProject.error.issues) issues.push(...translate(projectName, [], issue));
      continue;
    }

    for (const environment of entry.environments) {
      const onEnvironment = parseEnvironment(environment);
      if (onEnvironment.success) continue;

      for (const issue of onEnvironment.error.issues) {
        issues.push(...translate(String(environment?.name), [], issue));
      }
    }
  }

  return issues;
};
