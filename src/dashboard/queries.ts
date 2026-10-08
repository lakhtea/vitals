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
