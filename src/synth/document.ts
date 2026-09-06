import { Document } from "yaml";

import type { ValidatedBlueprint } from "../validation/validate.js";
import { BANNER } from "./banner.js";
import { ROOT_KEY_ORDER } from "./key-order.js";
import { mapping } from "./mapping.js";
import { services } from "./services.js";

export const document = (value: ValidatedBlueprint): Document => {
  const root = mapping(
    ROOT_KEY_ORDER,
    { services: value.resources.length === 0 ? undefined : services(value.resources) },
    undefined,
  );

  const doc = new Document(root);
  doc.commentBefore = BANNER;
  return doc;
};
