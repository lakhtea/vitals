"use client";

// The interactive dashboard: owns which site and which filters are chosen and
// renders the cards and tables. Its first render shows the result the Server
// Component already resolved, so server HTML and hydration are identical and
// no request is made; only a changed site or filter queries /api/graphql.
import { useQuery } from "@apollo/client/react";
import { useState, type ReactElement } from "react";
import type { DashboardQuery } from "@/graphql/generated/graphql";
import { METRIC_NAMES } from "@/vitals/metrics";
import { toMetricName, toMetricRating } from "../adapters";
import { DEFAULT_FILTERS, isDefaultFilters, toTrafficFilter, type DashboardFilters } from "../filters";
import { DASHBOARD } from "../queries";
import { DashboardHeader } from "./DashboardHeader";
import styles from "./DashboardView.module.css";
import { FilterBar } from "./FilterBar";
import { MetricCard } from "./MetricCard";
import { PagesTable } from "./PagesTable";
import { SessionsTable } from "./SessionsTable";

export type DashboardSite = NonNullable<DashboardQuery["site"]>;

export interface SiteOption {
  id: string;
  name: string;
}

export interface DashboardViewProps {
  /** Never empty: the Server Component renders the empty state itself. */
  sites: SiteOption[];
  /** The first site's dashboard under DEFAULT_FILTERS, resolved on the server. */
  initialSite: DashboardSite;
  /** Epoch ms read once on the server; every "last N days" window counts back from it. */
  asOf: number;
}

const SESSIONS_SHOWN = 50;

export const DashboardView = ({ sites, initialSite, asOf }: DashboardViewProps): ReactElement => {
  const [siteId, setSiteId] = useState(initialSite.id);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  // The server already answered this exact question; asking again on hydration
  // would be a wasted request. Any other site or filter is a client query.
  const isInitialView = siteId === initialSite.id && isDefaultFilters(filters);
  const { data, previousData, loading } = useQuery(DASHBOARD, {
    variables: { siteId, filter: toTrafficFilter({ filters, now: asOf }) },
    skip: isInitialView,
  });

  // Whatever is on screen stays there until the next result arrives: no layout shift.
  const resolveSite = (): DashboardSite | null => {
    if (isInitialView) {
      return initialSite;
    }
    const latest = data ?? previousData;
    return latest === undefined ? initialSite : latest.site;
  };
  const site = resolveSite();

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

  return (
    <main className={styles.page}>
      <DashboardHeader>
        <label className={styles.siteField}>
          Site
          <select className={styles.siteSelect} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {sites.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      </DashboardHeader>

      <FilterBar value={filters} onChange={setFilters} />

      <p className={styles.status} role="status">
        {loading && "Updating…"}
        {!loading && site === null && "This site no longer exists."}
      </p>

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
};
