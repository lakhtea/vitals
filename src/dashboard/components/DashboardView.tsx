"use client";

// The interactive dashboard: owns which site and which filters are chosen and
// lays out the toolbar, the attention strip, the cards, the trend, and the
// sections under them. Its first render shows the result the Server Component
// already resolved, so server HTML and hydration are identical and no request
// is made; only a changed site or filter queries /api/graphql.
import { useQuery } from "@apollo/client/react";
import { useId, useState, type ReactElement } from "react";
import { summarizeAttention } from "../attention";
import { DEFAULT_FILTERS, isDefaultFilters, toSeriesBucket, toTrafficFilter, type DashboardFilters } from "../filters";
import { toOverviewModel, type DashboardSite } from "../overviewModel";
import { DASHBOARD } from "../queries";
import { AttentionStrip } from "./AttentionStrip";
import { Brand } from "./Brand";
import styles from "./DashboardView.module.css";
import { FilterBar } from "./FilterBar";
import { HealthPanel } from "./HealthPanel";
import { IncidentsTable } from "./IncidentsTable";
import { MetricCard } from "./MetricCard";
import { MetricTrend } from "./MetricTrend";
import { PagesTable } from "./PagesTable";
import { SectionHeader } from "./SectionHeader";
import { SelectField } from "./SelectField";
import { SessionsTable } from "./SessionsTable";
import { Toolbar, ToolbarStatus } from "./Toolbar";

export type { DashboardSite } from "../overviewModel";

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
  const id = useId();
  const siteSelectId = `${id}-site`;
  const cardsHeadingId = `${id}-cards`;
  const [siteId, setSiteId] = useState(initialSite.id);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  // The server already answered this exact question; asking again on hydration
  // would be a wasted request. Any other site or filter is a client query.
  const isInitialView = siteId === initialSite.id && isDefaultFilters(filters);
  const { data, loading, error } = useQuery(DASHBOARD, {
    variables: { siteId, filter: toTrafficFilter({ filters, now: asOf }), bucket: toSeriesBucket(filters.range) },
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
  const status = resolveStatus();
  const model = site === null ? null : toOverviewModel(site);

  return (
    <main className={styles.page}>
      <Toolbar brand={<Brand />} secondRow={<FilterBar value={filters} onChange={setFilters} />}>
        <ToolbarStatus status={status} tone={error === undefined ? "neutral" : "poor"} />
        <SelectField id={siteSelectId} label="Site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          {sites.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </SelectField>
      </Toolbar>

      {model !== null && (
        <div className={styles.content}>
          {/* Incidents and checks are site state, not traffic: the filters do not narrow them. */}
          <AttentionStrip summary={summarizeAttention({ incidents: model.incidents, checks: model.checks })} />

          {/* A real level-2 heading, hidden, so the cards' h3s have a parent in the outline. */}
          <section aria-labelledby={cardsHeadingId}>
            <h2 id={cardsHeadingId} className={styles.visuallyHidden}>
              Site-wide p75 by metric
            </h2>
            <div className={styles.cards}>
              {model.cards.map((card) => (
                <MetricCard key={card.name} {...card} />
              ))}
            </div>
          </section>

          <MetricTrend series={model.series} />

          <section id="incidents" className={styles.section}>
            <SectionHeader title="Incidents" count={model.incidents.length} />
            <IncidentsTable incidents={model.incidents} />
          </section>

          <HealthPanel checks={model.checks} />

          <section className={styles.section}>
            <SectionHeader title="Pages" count={model.pages.length} />
            <PagesTable pages={model.pages} siteId={model.siteId} />
          </section>

          <section className={styles.section}>
            <SectionHeader title="Recent sessions" description={`The last ${SESSIONS_SHOWN} sessions that match the filters.`} />
            <SessionsTable sessions={model.sessions} />
          </section>
        </div>
      )}
    </main>
  );
};
