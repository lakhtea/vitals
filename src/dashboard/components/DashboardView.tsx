"use client";

// The interactive dashboard: owns which site and which filters are chosen and
// renders the cards and tables. Its first render shows the result the Server
// Component already resolved, so server HTML and hydration are identical and
// no request is made; only a changed site or filter queries /api/graphql.
import { useQuery } from "@apollo/client/react";
import { useId, useState, type ReactElement } from "react";
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
  const siteSelectId = useId();
  const [siteId, setSiteId] = useState(initialSite.id);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  // The server already answered this exact question; asking again on hydration
  // would be a wasted request. Any other site or filter is a client query.
  const isInitialView = siteId === initialSite.id && isDefaultFilters(filters);
  const { data, loading, error } = useQuery(DASHBOARD, {
    variables: { siteId, filter: toTrafficFilter({ filters, now: asOf }) },
    skip: isInitialView,
  });

  // The answer to the question currently asked, or undefined while it is still on its way.
  const resolveLatestSite = (): DashboardSite | null | undefined => {
    if (isInitialView) {
      return initialSite;
    }
    return data === undefined ? undefined : data.site;
  };
  const latestSite = resolveLatestSite();

  // Whatever is on screen stays there until the next result arrives: no layout
  // shift. Remembered here rather than read from Apollo's previousData, which
  // after a skipped (initial) view still holds the result before that one, so
  // a loading render would briefly show another site's tables.
  const [shownSite, setShownSite] = useState<DashboardSite | null>(initialSite);
  if (latestSite !== undefined && latestSite !== shownSite) {
    setShownSite(latestSite);
  }
  const site = latestSite === undefined ? shownSite : latestSite;

  const resolveStatus = (): string | null => {
    if (loading) {
      return "Updating…";
    }
    if (error !== undefined) {
      return `Could not update: ${error.message}`;
    }
    if (site === null) {
      return "This site no longer exists.";
    }
    return null;
  };

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
        {/* Explicit association: a select nested inside its label would be named "Site" plus its own value. */}
        <div className={styles.siteField}>
          <label htmlFor={siteSelectId}>Site</label>
          <select
            id={siteSelectId}
            className={styles.siteSelect}
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            {sites.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardHeader>

      <FilterBar value={filters} onChange={setFilters} />

      <p className={styles.status} role="status">
        {resolveStatus()}
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
