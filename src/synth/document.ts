import { Document } from 'yaml';

import type { ValidatedBlueprint } from '../validation/validate.js';
import { BANNER } from './banner.js';
import { databases } from './databases.js';
import { ROOT_KEY_ORDER } from './key-order.js';
import { mapping } from './mapping.js';
import { projects, ungrouped } from './projects.js';
import { rootPreviews } from './root-previews.js';
import { services } from './services.js';

export const document = (value: ValidatedBlueprint): Document => {
  const doc = new Document(
    mapping(
      ROOT_KEY_ORDER,
      {
        previews: rootPreviews(value.previews),
        services: services(value.resources),
        databases: databases(value.resources),
        projects: projects(value.projects),
        ungrouped: ungrouped(value.ungrouped),
      },
      value.extraFields,
    ),
  );

  doc.commentBefore = BANNER;
  return doc;
};
