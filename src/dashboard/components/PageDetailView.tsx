// Everything the page detail route shows, composed from the data the route
// resolved: toolbar, header, the five cards with sparklines, the trend chart,
// the two breakdown tables, and the sessions that visited the path. A Server
// Component; only the filter bar, the trend tabs, and the sessions window are
// client code, and each receives plain props.
import type { ReactElement } from "react";
import type { DashboardFilters } from "../filters";
import type { PageDetailData } from "../pageDetail";
import { BrandLink } from "./Brand";
import { BreakdownTable } from "./BreakdownTable";
import { MetricCard } from "./MetricCard";
import { MetricTrend } from "./MetricTrend";
import styles from "./PageDetail.module.css";
import { PageDetailEmptyState } from "./PageDetailEmptyState";
import { PageDetailHeader } from "./PageDetailHeader";
import { PageFilters } from "./PageFilters";
import { SectionHeader } from "./SectionHeader";
import { SessionsTable } from "./SessionsTable";
import { Toolbar } from "./Toolbar";

export interface PageDetailViewProps {
  siteId: string;
  siteName: string;
  path: string;
  filters: DashboardFilters;
  /** null when the site has no traffic on the path under the filters. */
  detail: PageDetailData | null;
}

/** Matches the `limit: 50` in the PAGE_DETAIL query. */
const SESSIONS_SHOWN = 50;

export const PageDetailView = ({ siteId, siteName, path, filters, detail }: PageDetailViewProps): ReactElement => (
  <>
    <Toolbar brand={<BrandLink />} secondRow={<PageFilters siteId={siteId} path={path} filters={filters} />}>
      <span className={styles.siteName}>{siteName}</span>
    </Toolbar>
    <main className={styles.page}>
      <PageDetailHeader
        path={path}
        siteName={siteName}
        facts={detail === null ? null : { pageviewCount: detail.pageviewCount, sampleCount: detail.sampleCount }}
      />
      {detail === null ? (
        <PageDetailEmptyState siteId={siteId} path={path} filters={filters} />
      ) : (
        <>
          {/* A real level-2 heading, hidden from sight, so the cards' h3s have a parent in the outline. */}
          <section className={styles.cards} aria-labelledby="page-cards-heading">
            <h2 id="page-cards-heading" className={styles.visuallyHidden}>
              p75 by metric for this page
            </h2>
            {detail.cards.map((card) => (
              <MetricCard key={card.name} {...card} />
            ))}
          </section>

          <MetricTrend series={detail.series} />

          <section className={styles.section} aria-labelledby="breakdown-heading">
            <SectionHeader id="breakdown-heading" title="Breakdown" />
            <div className={styles.breakdowns}>
              <BreakdownTable dimension="device" rows={detail.byDevice} />
              <BreakdownTable dimension="connection" rows={detail.byConnection} />
            </div>
          </section>

          {/* Not a labelled region: the table inside is the region, named "Recent sessions" like this heading. */}
          <section className={styles.section}>
            <SectionHeader
              title="Recent sessions"
              description={`The last ${SESSIONS_SHOWN} sessions on this page that match the filters.`}
            />
            <SessionsTable sessions={detail.sessions} />
          </section>
        </>
      )}
    </main>
  </>
);
