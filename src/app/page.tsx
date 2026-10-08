"use client";

// The dashboard home: every measured path with its traffic counts. A client
// component because Apollo's hooks need browser-side React context; M7 moves
// the first paint to the server.
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const SITES_WITH_PAGES = gql`
  query SitesWithPages {
    sites {
      id
      name
      pages {
        path
        pageviewCount
        eventCount
      }
    }
  }
`;

// Hand-written for now; M5 replaces this with generated types.
interface SitesWithPagesData {
  sites: Array<{
    id: string;
    name: string;
    pages: Array<{ path: string; pageviewCount: number; eventCount: number }>;
  }>;
}

const cellStyle = { textAlign: "left", padding: "0.4rem 0.6rem" } as const;
const numberCellStyle = {
  textAlign: "right",
  padding: "0.4rem 0.6rem",
} as const;

export default function Home() {
  const { data, loading, error } =
    useQuery<SitesWithPagesData>(SITES_WITH_PAGES);

  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Vitals</h1>
      <p>Core Web Vitals from real sessions, self-hosted.</p>

      {loading && <p>Loading…</p>}
      {error && <p role="alert">Failed to load pages: {error.message}</p>}

      {data && data.sites.length === 0 && (
        <p>
          No traffic yet. Run <code>npm run db:seed</code> for synthetic demo
          data.
        </p>
      )}

      {data &&
        data.sites.map((site) => (
          <section key={site.id} style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem" }}>{site.name}</h2>
            {site.pages.length === 0 && (
              <p style={{ marginTop: "0.5rem" }}>No traffic recorded yet.</p>
            )}
            {site.pages.length > 0 && (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "0.5rem",
                }}
              >
                <caption style={{ textAlign: "left", marginBottom: "0.5rem" }}>
                  {site.pages.length} page(s) measured
                </caption>
                <thead>
                  <tr>
                    <th style={cellStyle} scope="col">
                      Path
                    </th>
                    <th style={numberCellStyle} scope="col">
                      Pageviews
                    </th>
                    <th style={numberCellStyle} scope="col">
                      Metric events
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {site.pages.map((page) => (
                    <tr key={page.path}>
                      <td style={cellStyle}>{page.path}</td>
                      <td style={numberCellStyle}>{page.pageviewCount}</td>
                      <td style={numberCellStyle}>{page.eventCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
    </main>
  );
}
