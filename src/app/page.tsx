"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const APPLICATIONS = gql`
  query Applications {
    applications {
      id
      company
      role
      stage
      followUpOn
    }
  }
`;

interface ApplicationsData {
  applications: Array<{
    id: string;
    company: string;
    role: string;
    stage: string;
    followUpOn: string | null;
  }>;
}

// SESSION TODO: extract typed operations with GraphQL Codegen instead of the
// hand-written interface above; add create/edit forms; stage board view.

export default function Home() {
  const { data, loading, error } = useQuery<ApplicationsData>(APPLICATIONS);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Pipeline</h1>
      <p>Job applications, tracked with the tool they helped build.</p>

      {loading && <p>Loading…</p>}
      {error && <p role="alert">Failed to load applications: {error.message}</p>}

      {data && data.applications.length === 0 && (
        <p>
          No applications yet. Run <code>npm run db:seed</code> for demo data.
        </p>
      )}

      {data && data.applications.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", marginBottom: "0.5rem" }}>
            {data.applications.length} application(s)
          </caption>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }} scope="col">
                Company
              </th>
              <th style={{ textAlign: "left" }} scope="col">
                Role
              </th>
              <th style={{ textAlign: "left" }} scope="col">
                Stage
              </th>
              <th style={{ textAlign: "left" }} scope="col">
                Follow up
              </th>
            </tr>
          </thead>
          <tbody>
            {data.applications.map((app) => (
              <tr key={app.id}>
                <td>{app.company}</td>
                <td>{app.role}</td>
                <td>{app.stage}</td>
                <td>{app.followUpOn ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
