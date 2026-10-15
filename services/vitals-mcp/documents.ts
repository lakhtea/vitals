// The GraphQL operations behind the MCP tools, typed by codegen. Each tool is a
// thin wrapper over one or two of these, so the schema stays the one contract
// both the dashboard and the agents speak. Run `npm run codegen` after editing.
import { graphql } from "./generated";

export const MCP_OPEN_INCIDENTS = graphql(`
  query McpOpenIncidents($siteId: ID!, $status: IncidentStatus) {
    site(id: $siteId) {
      id
      incidents(status: $status) {
        id
        source
        subject
        metric
        status
        detectedAt
        vitalsEvidence {
          path
          metric
          relativeIncrease
          baseline {
            p75
            rating
          }
          current {
            p75
            rating
          }
        }
        checkEvidence {
          name
          status
          previousStatus
          consecutive
          detail
        }
      }
    }
  }
`);

export const MCP_INCIDENT_CONTEXT = graphql(`
  query McpIncidentContext($id: ID!) {
    incident(id: $id) {
      id
      siteId
      source
      subject
      metric
      status
      detectedAt
      updatedAt
      resolvedAt
      note
      vitalsEvidence {
        path
        metric
        relativeIncrease
        baseline {
          from
          to
          p75
          rating
          sampleCount
        }
        current {
          from
          to
          p75
          rating
          sampleCount
        }
      }
      checkEvidence {
        checkId
        name
        status
        previousStatus
        consecutive
        value
        unit
        observedAt
        detail
      }
      breakdown {
        byDevice {
          value
          baselineP75
          baselineSampleCount
          currentP75
          currentSampleCount
        }
        byConnection {
          value
          baselineP75
          baselineSampleCount
          currentP75
          currentSampleCount
        }
      }
      steps {
        id
        role
        status
        summary
        detail
        startedAt
        finishedAt
        model
        inputTokens
        outputTokens
        costUsd
        link
      }
    }
  }
`);

export const MCP_CHECK_HISTORY = graphql(`
  query McpCheckHistory($siteId: ID!, $limit: Int) {
    site(id: $siteId) {
      id
      checks {
        checkId
        name
        history(limit: $limit) {
          status
          value
          unit
          observedAt
          detail
        }
      }
    }
  }
`);

export const MCP_RECORD_STEP = graphql(`
  mutation McpRecordStep(
    $incidentId: ID!
    $role: StepRole!
    $status: StepStatus!
    $summary: String!
    $detail: String
    $startedAt: DateTime
    $finishedAt: DateTime
    $usage: StepUsageInput
    $link: String
  ) {
    recordStep(
      incidentId: $incidentId
      role: $role
      status: $status
      summary: $summary
      detail: $detail
      startedAt: $startedAt
      finishedAt: $finishedAt
      usage: $usage
      link: $link
    ) {
      id
      role
      status
      summary
      startedAt
      finishedAt
    }
  }
`);

export const MCP_TRANSITION_INCIDENT = graphql(`
  mutation McpTransitionIncident($id: ID!, $to: IncidentStatus!) {
    transitionIncident(id: $id, to: $to) {
      id
      status
    }
  }
`);
