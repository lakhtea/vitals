// Pure sorting for the pages table, kept out of the component so the
// comparator and the click-to-toggle rule can be read (and tested) without
// rendering anything.
import type { MetricName, MetricRating } from "@/vitals/metrics";

export interface PageMetricSummary {
  name: MetricName;
  p75: number;
  p75Rating: MetricRating;
}

export interface PageRowData {
  path: string;
  pageviewCount: number;
  metrics: PageMetricSummary[];
}

export const PAGE_METRIC_COLUMNS = ["LCP", "CLS", "INP"] as const satisfies readonly MetricName[];
export type PageMetricColumn = (typeof PAGE_METRIC_COLUMNS)[number];

export type PagesSortColumn = "path" | "pageviews" | PageMetricColumn;
export type SortDirection = "asc" | "desc";

export interface PageSort {
  column: PagesSortColumn;
  direction: SortDirection;
}

export const findPageMetric = ({
  page,
  name,
}: {
  page: PageRowData;
  name: MetricName;
}): PageMetricSummary | null => page.metrics.find((metric) => metric.name === name) ?? null;

const sortValue = ({ page, column }: { page: PageRowData; column: PagesSortColumn }): string | number | null => {
  if (column === "path") {
    return page.path;
  }
  if (column === "pageviews") {
    return page.pageviewCount;
  }
  return findPageMetric({ page, name: column })?.p75 ?? null;
};

const compareValues = (a: string | number, b: string | number): number => {
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return 0;
};

export const sortPages = ({
  pages,
  column,
  direction,
}: {
  pages: readonly PageRowData[];
  column: PagesSortColumn;
  direction: SortDirection;
}): PageRowData[] => {
  const sign = direction === "asc" ? 1 : -1;
  return [...pages].sort((left, right) => {
    const a = sortValue({ page: left, column });
    const b = sortValue({ page: right, column });
    // A page with no sample for this metric sinks to the bottom either way.
    if (a === null && b === null) {
      return 0;
    }
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    return sign * compareValues(a, b);
  });
};

/** Numbers open biggest-first (slowest pages are the interesting ones); text opens A to Z. */
export const defaultDirectionFor = (column: PagesSortColumn): SortDirection => (column === "path" ? "asc" : "desc");

/** Clicking the active column flips it; clicking another column opens it in its default direction. */
export const toggleSort = ({ current, column }: { current: PageSort; column: PagesSortColumn }): PageSort => {
  if (current.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { column, direction: defaultDirectionFor(column) };
};
