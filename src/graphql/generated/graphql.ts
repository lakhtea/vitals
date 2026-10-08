/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type ConnectionType =
  | 'FOUR_G'
  | 'SLOW_2G'
  | 'THREE_G'
  | 'TWO_G'
  | 'UNKNOWN';

export type DeviceClass =
  | 'DESKTOP'
  | 'MOBILE'
  | 'TABLET'
  | 'UNKNOWN';

export type MetricName =
  | 'CLS'
  | 'FCP'
  | 'INP'
  | 'LCP'
  | 'TTFB';

export type MetricRating =
  | 'GOOD'
  | 'NEEDS_IMPROVEMENT'
  | 'POOR';

/** Narrow traffic to a half-open time window [from, to) and/or session dimensions. Every field is optional. */
export type TrafficFilter = {
  connectionType?: ConnectionType | null | undefined;
  deviceClass?: DeviceClass | null | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
};

export type SitesQueryVariables = Exact<{ [key: string]: never; }>;


export type SitesQuery = { sites: Array<{ id: string, name: string }> };

export type DashboardQueryVariables = Exact<{
  siteId: string | number;
  filter?: TrafficFilter | null | undefined;
}>;


export type DashboardQuery = { site: { id: string, name: string, metrics: Array<{ name: MetricName, p75: number, p75Rating: MetricRating, sampleCount: number }>, pages: Array<{ path: string, pageviewCount: number, metrics: Array<{ name: MetricName, p75: number, p75Rating: MetricRating }> }>, sessions: Array<{ id: string, startedAt: string, deviceClass: DeviceClass, connectionType: ConnectionType, userAgentFamily: string, pageviews: Array<{ path: string }> }> } | null };

export type SelfMeasurementQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfMeasurementQuery = { site: { id: string, name: string, metrics: Array<{ name: MetricName, p75: number, p75Rating: MetricRating, sampleCount: number }> } | null };


export const SitesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<SitesQuery, SitesQueryVariables>;
export const DashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Dashboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TrafficFilter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"site"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"p75Rating"}},{"kind":"Field","name":{"kind":"Name","value":"sampleCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"pageviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"p75Rating"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deviceClass"}},{"kind":"Field","name":{"kind":"Name","value":"connectionType"}},{"kind":"Field","name":{"kind":"Name","value":"userAgentFamily"}},{"kind":"Field","name":{"kind":"Name","value":"pageviews"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}}]}}]}}]}}]}}]} as unknown as DocumentNode<DashboardQuery, DashboardQueryVariables>;
export const SelfMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SelfMeasurement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"site"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"StringValue","value":"vitals-dashboard","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"p75Rating"}},{"kind":"Field","name":{"kind":"Name","value":"sampleCount"}}]}}]}}]}}]} as unknown as DocumentNode<SelfMeasurementQuery, SelfMeasurementQueryVariables>;