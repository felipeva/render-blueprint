import { Document, type DocumentOptions, type SchemaOptions } from 'yaml';

import type { ValidatedBlueprint } from '../validation/validate.js';
import { BANNER } from './banner.js';
import { databases } from './databases.js';
import { envVarGroups } from './env-var-groups.js';
import { ROOT_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';
import { projects, ungrouped } from './projects.js';
import { rootPreviews } from './root-previews.js';
import { services } from './services.js';

// Render reads YAML 1.1, where `off`, `yes` and `1_000` are not strings; `compat` quotes them.
const DOCUMENT_OPTIONS: DocumentOptions & SchemaOptions = { compat: 'yaml-1.1' };

export const document = (value: ValidatedBlueprint): Document => {
  const doc = new Document(
    mapping(
      ROOT_KEY_ORDER,
      {
        previews: rootPreviews(value.previews),
        services: services(value.resources),
        databases: databases(value.resources),
        envVarGroups: envVarGroups(value.resources),
        projects: projects(value.projects),
        ungrouped: ungrouped(value.ungrouped),
      },
      value.extraFields,
    ),
    DOCUMENT_OPTIONS,
  );

  doc.commentBefore = BANNER;
  return doc;
};
