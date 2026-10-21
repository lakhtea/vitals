// Pure helpers for the page detail route: the URL search params become
// DashboardFilters through a schema that never trusts the address bar, and the
// PageDetail wire shape becomes the rows the cards and tables render. No I/O,
// so the route file stays a loader and these stay unit-testable.
import { z } from "zod";
import type { PageDetailQuery } from "@/graphql/generated/graphql";
import { type MetricName, type MetricRating } from "@/vitals/metrics";
import { toMetricCards, toMetricName, toMetricRating, toMetricSeries, type MetricCardData, type MetricSeriesData } from "./adapters";
import type { SessionRowData } from "./components/SessionsTable";
import {
  CONNECTION_TYPE_OPTIONS,
  DEVICE_CLASS_OPTIONS,
  DEFAULT_FILTERS,
  TIME_RANGE_OPTIONS,
  type DashboardFilters,
} from "./filters";
import { SITE_TITLE } from "./labels";
import { PAGE_DETAIL_PARAM } from "./routes";

/** What Next hands a page for `?a=1&a=2`: a string, a list, or nothing. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

// The vocabulary comes from the same constants the filter bar offers, so a
// range added there is accepted here without a second list to keep in step.
const TIME_RANGE_KEYS = TIME_RANGE_OPTIONS.map((option) => option.key);

// `.catch` turns anything the enum rejects (a typo, a repeated key, an
// injection attempt) into the default for that one field, so one bad value
// never discards the valid ones beside it.
const searchParamsSchema = z.object({
  [PAGE_DETAIL_PARAM.range]: z.enum(TIME_RANGE_KEYS).catch(DEFAULT_FILTERS.range),
  [PAGE_DETAIL_PARAM.device]: z.enum(DEVICE_CLASS_OPTIONS).nullable().catch(null),
  [PAGE_DETAIL_PARAM.connection]: z.enum(CONNECTION_TYPE_OPTIONS).nullable().catch(null),
});

export const parsePageDetailSearchParams = (raw: RawSearchParams): DashboardFilters => {
  const parsed = searchParamsSchema.parse(raw);
  return { range: parsed.range, deviceClass: parsed.device, connectionType: parsed.connection };
};

// A path is a pathname: anything else (a list, a bare word) is treated as absent.
const pathParamSchema = z.string().startsWith("/").nullable().catch(null);

/** The `path` search param, which carries a path the URL's segments cannot; null when absent or not a path. */
export const parsePagePathParam = (raw: RawSearchParams): string | null =>
  pathParamSchema.parse(raw[PAGE_DETAIL_PARAM.path] ?? null);

/** True when no filter narrows the traffic, so "no data" means the path has never been seen. */
export const isUnfilteredView = (filters: DashboardFilters): boolean =>
  filters.range === "all" && filters.deviceClass === null && filters.connectionType === null;


/** "/pricing · Demo site - Vitals": the path first, since that is what the tab is about. */
export const pageDetailTitle = ({ path, siteName }: { path: string; siteName: string }): string =>
  `${path} · ${siteName} - ${SITE_TITLE}`;

export interface BreakdownMetricData {
  p75: number;
  rating: MetricRating;
}

export interface BreakdownRowData {
  /** The raw enum value ("FOUR_G"); the table turns it into a label. */
  value: string;
  metrics: Partial<Record<MetricName, BreakdownMetricData>>;
  /** Pageviews measured for this value, approximated as described in breakdownSampleCount. */
  sampleCount: number;
}

export interface PageDetailData {
  siteId: string;
  siteName: string;
  path: string;
  pageviewCount: number;
  /** Metric samples across all five metrics, the number behind every p75 on the page. */
  sampleCount: number;
  cards: MetricCardData[];
  series: MetricSeriesData[];
  byDevice: BreakdownRowData[];
  byConnection: BreakdownRowData[];
  sessions: SessionRowData[];
}

type WirePage = NonNullable<NonNullable<PageDetailQuery["site"]>["page"]>;
type WireBreakdownRow = WirePage["breakdown"]["byDevice"][number];

/**
 * A pageview reports up to five metrics, so summing the per-metric counts
 * would count one visit up to five times. The most-reported metric's count is
 * the closest thing to "pageviews measured for this value", so that is the
 * figure the samples column shows.
 */
const breakdownSampleCount = (metrics: WireBreakdownRow["metrics"]): number =>
  metrics.reduce((max, metric) => Math.max(max, metric.sampleCount), 0);

const toBreakdownRow = (row: WireBreakdownRow): BreakdownRowData => ({
  value: row.value,
  metrics: Object.fromEntries(
    row.metrics.map((metric) => [toMetricName(metric.name), { p75: metric.p75, rating: toMetricRating(metric.p75Rating) }]),
  ),
  sampleCount: breakdownSampleCount(row.metrics),
});

export const toPageDetail = ({
  site,
  page,
}: {
  site: { id: string; name: string };
  page: WirePage;
}): PageDetailData => {
  const series = toMetricSeries(page.series);

  return {
    siteId: site.id,
    siteName: site.name,
    path: page.path,
    pageviewCount: page.pageviewCount,
    sampleCount: page.metrics.reduce((total, metric) => total + metric.sampleCount, 0),
    cards: toMetricCards({ metrics: page.metrics, series }),
    series,
    byDevice: page.breakdown.byDevice.map(toBreakdownRow),
    byConnection: page.breakdown.byConnection.map(toBreakdownRow),
    sessions: page.sessions,
  };
};
