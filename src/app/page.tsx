"use client";

// The dashboard overview. Owns two pieces of state (which site, which filters),
// fetches one typed document, and hands plain props to the components. A
// client component for now; M7 moves the first paint to the server.
import { useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import { toMetricName, toMetricRating } from "@/dashboard/adapters";
import { DEFAULT_FILTERS, FilterBar, type DashboardFilters } from "@/dashboard/components/FilterBar";
import { MetricCard } from "@/dashboard/components/MetricCard";
import { PagesTable } from "@/dashboard/components/PagesTable";
import { SessionsTable } from "@/dashboard/components/SessionsTable";
import { toTrafficFilter } from "@/dashboard/filters";
import { graphql } from "@/graphql/generated";
import { METRIC_NAMES } from "@/vitals/metrics";
import styles from "./page.module.css";

const SITES = graphql(`
  query Sites {
    sites {
      id
      name
    }
  }
`);

const DASHBOARD = graphql(`
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

const SESSIONS_SHOWN = 50;
// Evaluated once per page load, outside render, so the "last 7 days" window is
// stable across re-renders and the React compiler's purity rule is respected.
const PAGE_LOADED_AT = Date.now();

export default function Home() {
  const sitesQuery = useQuery(SITES);
  const [chosenSiteId, setChosenSiteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const sites = sitesQuery.data?.sites ?? [];
  const siteId = chosenSiteId ?? sites[0]?.id ?? null;
  const filter = useMemo(() => toTrafficFilter({ filters, now: PAGE_LOADED_AT }), [filters]);

  const dashboard = useQuery(DASHBOARD, {
    variables: { siteId: siteId ?? "", filter },
    skip: siteId === null,
  });
  // Keep the previous result on screen while a new filter loads: no layout shift.
  const site = (dashboard.data ?? dashboard.previousData)?.site ?? null;

  const cards = METRIC_NAMES.map((name) => {
    const summary = site?.metrics.find((metric) => toMetricName(metric.name) === name);
    return {
      name,
      p75: summary?.p75 ?? null,
      rating: summary ? toMetricRating(summary.p75Rating) : null,
      sampleCount: summary?.sampleCount ?? 0,
    };
  });

  const pages = (site?.pages ?? []).map((page) => ({
    path: page.path,
    pageviewCount: page.pageviewCount,
    metrics: page.metrics.map((metric) => ({
      name: toMetricName(metric.name),
      p75: metric.p75,
      p75Rating: toMetricRating(metric.p75Rating),
    })),
  }));

  const error = sitesQuery.error ?? dashboard.error;
  const isLoading = sitesQuery.loading || (dashboard.loading && site === null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Vitals</h1>
          <p className={styles.tagline}>Core Web Vitals from real sessions, self-hosted.</p>
        </div>
        {sites.length > 0 && (
          <label className={styles.siteField}>
            Site
            <select
              className={styles.siteSelect}
              value={siteId ?? ""}
              onChange={(event) => setChosenSiteId(event.target.value)}
            >
              {sites.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <FilterBar value={filters} onChange={setFilters} />

      <p className={styles.status} role="status">
        {isLoading && "Loading…"}
        {!isLoading && sites.length === 0 && (
          <>
            No sites yet. Run <code>npm run db:seed</code> for synthetic demo data.
          </>
        )}
      </p>
      {error && <p role="alert">Failed to load the dashboard: {error.message}</p>}

      {site && (
        <>
          <section className={styles.cards} aria-label="Site-wide p75 by metric">
            {cards.map((card) => (
              <MetricCard key={card.name} {...card} />
            ))}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Pages</h2>
            <PagesTable pages={pages} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent sessions (last {SESSIONS_SHOWN})</h2>
            <SessionsTable sessions={site.sessions} />
          </section>
        </>
      )}
    </main>
  );
}
