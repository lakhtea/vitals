/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** What an application reported about one of its checks. */
export type CheckStatus =
  | 'DEGRADED'
  | 'FAILING'
  | 'OK';

/** Which detector opened the incident. */
export type IncidentSource =
  | 'HEALTH_CHECK'
  | 'WEB_VITALS';

/** Where an incident is in its life. Agents walk OPEN through AWAITING_HUMAN; a human APPROVES or DISMISSES; the detector RESOLVES. */
export type IncidentStatus =
  | 'APPROVED'
  | 'AWAITING_HUMAN'
  | 'DISMISSED'
  | 'FIX_PROPOSED'
  | 'OPEN'
  | 'RESOLVED'
  | 'REVIEWED'
  | 'TRIAGED';

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

/** Who took a step on an incident: one of the agent roles, or the human. */
export type StepRole =
  | 'HUMAN'
  | 'OPEN_PR'
  | 'PROPOSE_FIX'
  | 'REVIEW'
  | 'SUMMARIZE';

export type StepStatus =
  | 'FAILED'
  | 'RUNNING'
  | 'SUCCEEDED';

/** What the model call behind a step cost. Every field is optional; numbers must not be negative. */
export type StepUsageInput = {
  costUsd?: number | null | undefined;
  inputTokens?: number | null | undefined;
  model?: string | null | undefined;
  outputTokens?: number | null | undefined;
};

export type McpOpenIncidentsQueryVariables = Exact<{
  siteId: string | number;
  status?: IncidentStatus | null | undefined;
}>;


export type McpOpenIncidentsQuery = { site: { id: string, incidents: Array<{ id: string, source: IncidentSource, subject: string, metric: MetricName | null, status: IncidentStatus, detectedAt: string, vitalsEvidence: { path: string, metric: MetricName, relativeIncrease: number, baseline: { p75: number, rating: MetricRating }, current: { p75: number, rating: MetricRating } } | null, checkEvidence: { name: string, status: CheckStatus, previousStatus: CheckStatus | null, consecutive: number, detail: string | null } | null }> } | null };

export type McpIncidentContextQueryVariables = Exact<{
  id: string | number;
}>;


export type McpIncidentContextQuery = { incident: { id: string, siteId: string, source: IncidentSource, subject: string, metric: MetricName | null, status: IncidentStatus, detectedAt: string, updatedAt: string, resolvedAt: string | null, note: string | null, vitalsEvidence: { path: string, metric: MetricName, relativeIncrease: number, baseline: { from: string, to: string, p75: number, rating: MetricRating, sampleCount: number }, current: { from: string, to: string, p75: number, rating: MetricRating, sampleCount: number } } | null, checkEvidence: { checkId: string, name: string, status: CheckStatus, previousStatus: CheckStatus | null, consecutive: number, value: number | null, unit: string | null, observedAt: string, detail: string | null } | null, breakdown: { byDevice: Array<{ value: string, baselineP75: number | null, baselineSampleCount: number, currentP75: number | null, currentSampleCount: number }>, byConnection: Array<{ value: string, baselineP75: number | null, baselineSampleCount: number, currentP75: number | null, currentSampleCount: number }> } | null, steps: Array<{ id: string, role: StepRole, status: StepStatus, summary: string, detail: string | null, startedAt: string, finishedAt: string | null, model: string | null, inputTokens: number | null, outputTokens: number | null, costUsd: number | null, link: string | null }> } | null };

export type McpCheckHistoryQueryVariables = Exact<{
  siteId: string | number;
  limit?: number | null | undefined;
}>;


export type McpCheckHistoryQuery = { site: { id: string, checks: Array<{ checkId: string, name: string, history: Array<{ status: CheckStatus, value: number | null, unit: string | null, observedAt: string, detail: string | null }> }> } | null };

export type McpRecordStepMutationVariables = Exact<{
  incidentId: string | number;
  role: StepRole;
  status: StepStatus;
  summary: string;
  detail?: string | null | undefined;
  startedAt?: string | null | undefined;
  finishedAt?: string | null | undefined;
  usage?: StepUsageInput | null | undefined;
  link?: string | null | undefined;
}>;


export type McpRecordStepMutation = { recordStep: { id: string, role: StepRole, status: StepStatus, summary: string, startedAt: string, finishedAt: string | null } };

export type McpTransitionIncidentMutationVariables = Exact<{
  id: string | number;
  to: IncidentStatus;
}>;


export type McpTransitionIncidentMutation = { transitionIncident: { id: string, status: IncidentStatus } };


export const McpOpenIncidentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"McpOpenIncidents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"IncidentStatus"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"site"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"incidents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"vitalsEvidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"relativeIncrease"}},{"kind":"Field","name":{"kind":"Name","value":"baseline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"current"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"checkEvidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"previousStatus"}},{"kind":"Field","name":{"kind":"Name","value":"consecutive"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]}}]}}]}}]} as unknown as DocumentNode<McpOpenIncidentsQuery, McpOpenIncidentsQueryVariables>;
export const McpIncidentContextDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"McpIncidentContext"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"incident"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"siteId"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"vitalsEvidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"relativeIncrease"}},{"kind":"Field","name":{"kind":"Name","value":"baseline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"sampleCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"current"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"p75"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"sampleCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"checkEvidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"previousStatus"}},{"kind":"Field","name":{"kind":"Name","value":"consecutive"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"observedAt"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"byDevice"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"baselineP75"}},{"kind":"Field","name":{"kind":"Name","value":"baselineSampleCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentP75"}},{"kind":"Field","name":{"kind":"Name","value":"currentSampleCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"byConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"baselineP75"}},{"kind":"Field","name":{"kind":"Name","value":"baselineSampleCount"}},{"kind":"Field","name":{"kind":"Name","value":"currentP75"}},{"kind":"Field","name":{"kind":"Name","value":"currentSampleCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"inputTokens"}},{"kind":"Field","name":{"kind":"Name","value":"outputTokens"}},{"kind":"Field","name":{"kind":"Name","value":"costUsd"}},{"kind":"Field","name":{"kind":"Name","value":"link"}}]}}]}}]}}]} as unknown as DocumentNode<McpIncidentContextQuery, McpIncidentContextQueryVariables>;
export const McpCheckHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"McpCheckHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"site"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"checks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"history"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"observedAt"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]}}]}}]}}]} as unknown as DocumentNode<McpCheckHistoryQuery, McpCheckHistoryQueryVariables>;
export const McpRecordStepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"McpRecordStep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incidentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"role"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StepRole"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StepStatus"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"summary"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"detail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"finishedAt"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"usage"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"StepUsageInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"link"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordStep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"incidentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incidentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"role"},"value":{"kind":"Variable","name":{"kind":"Name","value":"role"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"summary"},"value":{"kind":"Variable","name":{"kind":"Name","value":"summary"}}},{"kind":"Argument","name":{"kind":"Name","value":"detail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"detail"}}},{"kind":"Argument","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}}},{"kind":"Argument","name":{"kind":"Name","value":"finishedAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"finishedAt"}}},{"kind":"Argument","name":{"kind":"Name","value":"usage"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usage"}}},{"kind":"Argument","name":{"kind":"Name","value":"link"},"value":{"kind":"Variable","name":{"kind":"Name","value":"link"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<McpRecordStepMutation, McpRecordStepMutationVariables>;
export const McpTransitionIncidentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"McpTransitionIncident"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IncidentStatus"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transitionIncident"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<McpTransitionIncidentMutation, McpTransitionIncidentMutationVariables>;