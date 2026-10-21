// The Dashboard query result reshaped into what the overview's components
// take: one card per metric, page rows, incident rows, checks, and the
// series. Kept out of DashboardView so the view only decides what to show
// where, and the translation from wire enums to UI vocabulary is in one place.
import type { DashboardQuery } from "@/graphql/generated/graphql";
import {
  toCheckStatus,
  toIncidentEvidence,
  toIncidentSource,
  toIncidentStatus,
  toMetricCards,
  toMetricName,
  toMetricRating,
  toMetricSeries,
  type MetricCardData,
  type MetricSeriesData,
} from "./adapters";
import type { HealthCheckData } from "./components/HealthPanel";
import type { IncidentRowData } from "./components/IncidentsTable";
import type { SessionRowData } from "./components/SessionsTable";
import { describeEvidence, incidentTitle } from "./incidents";
import type { PageRowData } from "./sortPages";

export type DashboardSite = NonNullable<DashboardQuery["site"]>;

export type { MetricCardData } from "./adapters";

export interface OverviewModel {
  siteId: string;
  cards: MetricCardData[];
  series: MetricSeriesData[];
  pages: PageRowData[];
  incidents: IncidentRowData[];
  checks: HealthCheckData[];
  sessions: SessionRowData[];
}

const toPages = (site: DashboardSite): PageRowData[] =>
  site.pages.map((page) => ({
    path: page.path,
    pageviewCount: page.pageviewCount,
    metrics: page.metrics.map((metric) => ({
      name: toMetricName(metric.name),
      p75: metric.p75,
      p75Rating: toMetricRating(metric.p75Rating),
    })),
  }));

const toIncidents = (site: DashboardSite): IncidentRowData[] =>
  site.incidents.map((incident) => {
    const source = toIncidentSource(incident.source);
    const metric = incident.metric === null ? null : toMetricName(incident.metric);
    const evidence = toIncidentEvidence(incident);
    return {
      id: incident.id,
      source,
      subject: incident.subject,
      metric,
      status: toIncidentStatus(incident.status),
      detectedAt: incident.detectedAt,
      title: incidentTitle({ source, subject: incident.subject, metric, evidence }),
      headline: describeEvidence(evidence),
    };
  });

const toChecks = (site: DashboardSite): HealthCheckData[] =>
  site.checks.map((check) => ({
    checkId: check.checkId,
    name: check.name,
    status: toCheckStatus(check.status),
    value: check.value,
    unit: check.unit,
    observedAt: check.observedAt,
    detail: check.detail,
  }));

export const toOverviewModel = (site: DashboardSite): OverviewModel => {
  const series = toMetricSeries(site.series);
  return {
    siteId: site.id,
    cards: toMetricCards({ metrics: site.metrics, series }),
    series,
    pages: toPages(site),
    incidents: toIncidents(site),
    checks: toChecks(site),
    sessions: site.sessions,
  };
};
