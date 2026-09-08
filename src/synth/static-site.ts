import { YAMLSeq, type YAMLMap } from 'yaml';

import { resourceEnv } from '../resources/resource.js';
import {
  HEADER_FIELDS,
  ROUTE_FIELDS,
  STATIC_SITE_FIELDS,
  STATIC_SITE_PREVIEWS_FIELDS,
  type Header,
  type Route,
  type StaticSite,
  type StaticSitePreviews,
} from '../resources/static-site.js';
import { buildFilter } from './build-filter.js';
import { envVars } from './env-vars.js';
import { ipAllowList } from './ip-allow-list.js';
import { mapping } from './mapping.js';

const staticSitePreviews = (value: StaticSitePreviews | undefined): YAMLMap | undefined =>
  value === undefined
    ? undefined
    : mapping(STATIC_SITE_PREVIEWS_FIELDS, { generation: value.generation }, undefined);

const headers = (values: readonly Header[]): YAMLSeq => {
  const node = new YAMLSeq();

  for (const header of values) {
    node.add(
      mapping(
        HEADER_FIELDS,
        { path: header.path, name: header.name, value: header.value },
        undefined,
      ),
    );
  }

  return node;
};

const routes = (values: readonly Route[]): YAMLSeq => {
  const node = new YAMLSeq();

  for (const route of values) {
    node.add(
      mapping(
        ROUTE_FIELDS,
        { type: route.type, source: route.source, destination: route.destination },
        undefined,
      ),
    );
  }

  return node;
};

// spec §0.2: type: web is overloaded; runtime: static is what narrows it to a static site.
export const staticSite = (resource: StaticSite): YAMLMap => {
  const config = resource.config;

  return mapping(
    STATIC_SITE_FIELDS,
    {
      type: 'web',
      name: resource.name,
      runtime: 'static',
      buildCommand: config.buildCommand,
      staticPublishPath: config.staticPublishPath,
      previews: staticSitePreviews(config.previews),
      buildFilter: buildFilter(config.buildFilter),
      headers: config.headers === undefined ? undefined : headers(config.headers),
      routes: config.routes === undefined ? undefined : routes(config.routes),
      envVars: envVars(resourceEnv(resource), config.envGroups),
      rootDir: config.rootDir,
      repo: config.repo,
      branch: config.branch,
      domains: config.domains,
      autoDeployTrigger: config.autoDeployTrigger,
      preDeployCommand: config.preDeployCommand,
      ipAllowList: config.ipAllowList === undefined ? undefined : ipAllowList(config.ipAllowList),
      renderSubdomainPolicy: config.renderSubdomainPolicy,
    },
    config.extraFields,
  );
};
