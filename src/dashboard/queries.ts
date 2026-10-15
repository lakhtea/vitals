// The dashboard's GraphQL documents, typed by codegen. One module so the
// Server Component that preloads and the Client Component that reads share the
// exact same document: Apollo's server-to-client transport matches on it.
import { graphql } from "@/graphql/generated";

export const SITES = graphql(`
  query Sites {
    sites {
      id
      name
    }
  }
`);

export const DASHBOARD = graphql(`
  query Dashboard($siteId: ID!, $filter: TrafficFilter) {
    site(id: $siteId) {
      id
      name
      metrics(filter: $filter) {
        name
        p75
        p75Rating
        sampleCount
      }
      pages(filter: $filter) {
        path
        pageviewCount
        metrics(filter: $filter) {
          name
          p75
          p75Rating
        }
      }
      sessions(filter: $filter, limit: 50) {
        id
        startedAt
        deviceClass
        connectionType
        userAgentFamily
        pageviews {
          path
        }
      }
      checks {
        checkId
        name
        status
        value
        unit
        observedAt
        detail
      }
      incidents {
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
      }
    }
  }
`);

/**
 * Everything the incident detail route shows. One fragment shared by the query
 * and both decision mutations, so a decision's response carries the same shape
 * the page rendered from and Apollo updates that one cache entry in place.
 */
export const INCIDENT_DETAIL = graphql(`
  fragment IncidentDetail on Incident {
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
    latestFixRevision {
      id
      number
      author
      createdAt
      summary
      targetRepo
      baseSha
      reviewed
      files {
        path
        action
        diff
        afterContent
      }
    }
    fixRevisions {
      number
      author
      createdAt
      summary
    }
    approvedRevision {
      number
      author
    }
    vitalsEvidence {
      path
      metric
      relativeIncrease
      baseline {
        from
        to
        p75
        sampleCount
        rating
      }
      current {
        from
        to
        p75
        sampleCount
        rating
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
    steps {
      id
      role
      status
      startedAt
      finishedAt
      summary
      detail
      model
      inputTokens
      outputTokens
      costUsd
      link
    }
  }
`);

export const INCIDENT = graphql(`
  query Incident($id: ID!) {
    incident(id: $id) {
      ...IncidentDetail
    }
  }
`);

export const APPROVE_INCIDENT = graphql(`
  mutation ApproveIncident($id: ID!, $note: String, $revisionId: ID) {
    approveIncident(id: $id, note: $note, revisionId: $revisionId) {
      ...IncidentDetail
    }
  }
`);

export const DISMISS_INCIDENT = graphql(`
  mutation DismissIncident($id: ID!, $note: String) {
    dismissIncident(id: $id, note: $note) {
      ...IncidentDetail
    }
  }
`);

/** A person's edit to the latest proposed change; the server writes it as the next revision. */
export const EDIT_FIX_REVISION = graphql(`
  mutation EditFixRevision($revisionId: ID!, $files: [FixFileEdit!]!, $note: String) {
    editFixRevision(revisionId: $revisionId, files: $files, note: $note) {
      id
      number
    }
  }
`);

/** The dashboard's own all-time rollup: no filter, so every session it ever reported counts. */
export const SELF_MEASUREMENT = graphql(`
  query SelfMeasurement {
    site(id: "vitals-dashboard") {
      id
      name
      metrics {
        name
        p75
        p75Rating
        sampleCount
      }
    }
  }
`);
