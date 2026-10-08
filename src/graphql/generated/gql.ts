/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Sites {\n    sites {\n      id\n      name\n    }\n  }\n": typeof types.SitesDocument,
    "\n  query Dashboard($siteId: ID!, $filter: TrafficFilter) {\n    site(id: $siteId) {\n      id\n      name\n      metrics(filter: $filter) {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n      pages(filter: $filter) {\n        path\n        pageviewCount\n        metrics(filter: $filter) {\n          name\n          p75\n          p75Rating\n        }\n      }\n      sessions(filter: $filter, limit: 50) {\n        id\n        startedAt\n        deviceClass\n        connectionType\n        userAgentFamily\n        pageviews {\n          path\n        }\n      }\n    }\n  }\n": typeof types.DashboardDocument,
    "\n  query SelfMeasurement {\n    site(id: \"vitals-dashboard\") {\n      id\n      name\n      metrics {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n    }\n  }\n": typeof types.SelfMeasurementDocument,
};
const documents: Documents = {
    "\n  query Sites {\n    sites {\n      id\n      name\n    }\n  }\n": types.SitesDocument,
    "\n  query Dashboard($siteId: ID!, $filter: TrafficFilter) {\n    site(id: $siteId) {\n      id\n      name\n      metrics(filter: $filter) {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n      pages(filter: $filter) {\n        path\n        pageviewCount\n        metrics(filter: $filter) {\n          name\n          p75\n          p75Rating\n        }\n      }\n      sessions(filter: $filter, limit: 50) {\n        id\n        startedAt\n        deviceClass\n        connectionType\n        userAgentFamily\n        pageviews {\n          path\n        }\n      }\n    }\n  }\n": types.DashboardDocument,
    "\n  query SelfMeasurement {\n    site(id: \"vitals-dashboard\") {\n      id\n      name\n      metrics {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n    }\n  }\n": types.SelfMeasurementDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Sites {\n    sites {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query Sites {\n    sites {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Dashboard($siteId: ID!, $filter: TrafficFilter) {\n    site(id: $siteId) {\n      id\n      name\n      metrics(filter: $filter) {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n      pages(filter: $filter) {\n        path\n        pageviewCount\n        metrics(filter: $filter) {\n          name\n          p75\n          p75Rating\n        }\n      }\n      sessions(filter: $filter, limit: 50) {\n        id\n        startedAt\n        deviceClass\n        connectionType\n        userAgentFamily\n        pageviews {\n          path\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Dashboard($siteId: ID!, $filter: TrafficFilter) {\n    site(id: $siteId) {\n      id\n      name\n      metrics(filter: $filter) {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n      pages(filter: $filter) {\n        path\n        pageviewCount\n        metrics(filter: $filter) {\n          name\n          p75\n          p75Rating\n        }\n      }\n      sessions(filter: $filter, limit: 50) {\n        id\n        startedAt\n        deviceClass\n        connectionType\n        userAgentFamily\n        pageviews {\n          path\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SelfMeasurement {\n    site(id: \"vitals-dashboard\") {\n      id\n      name\n      metrics {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n    }\n  }\n"): (typeof documents)["\n  query SelfMeasurement {\n    site(id: \"vitals-dashboard\") {\n      id\n      name\n      metrics {\n        name\n        p75\n        p75Rating\n        sampleCount\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;