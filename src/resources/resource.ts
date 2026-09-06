import { WEB_SERVICE_FIELDS, type WebService } from './web.js';

export type BlueprintResource = WebService;

export const modeledFields = (resource: BlueprintResource): readonly string[] => {
  switch (resource.kind) {
    case 'web':
      return WEB_SERVICE_FIELDS;
  }
};
