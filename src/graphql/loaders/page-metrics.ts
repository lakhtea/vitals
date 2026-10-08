// The batch function behind Page.metrics. DataLoader hands it every
// (site, path, filter) key requested during one tick of the event loop; it
// runs one SQL statement per distinct filter and returns results in key
// order, which is the contract DataLoader requires.
import type { Db } from "@/db";
import { filterKey, type TrafficFilter } from "@/db/queries/filter";
import { loadPageMetrics, type MetricSummaryRow } from "@/db/queries/metrics";

export interface PageMetricsKey {
  siteId: string;
  path: string;
  filter: TrafficFilter;
}

const SEPARATOR = "\u0000";

const pageKey = (key: { siteId: string; path: string | null; filter: TrafficFilter }): string =>
  [filterKey(key.filter), key.siteId, key.path].join(SEPARATOR);

/** DataLoader memoises by this string, so two fields asking for the same page and range share one load. */
export const pageMetricsCacheKey = (key: PageMetricsKey): string => pageKey(key);

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> =>
  items.reduce((groups, item) => {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());

export const batchLoadPageMetrics = ({
  db,
  keys,
}: {
  db: Db;
  keys: readonly PageMetricsKey[];
}): MetricSummaryRow[][] => {
  const keysByFilter = groupBy(keys, (key) => filterKey(key.filter));

  const rowsByPage = new Map<string, MetricSummaryRow[]>();
  for (const group of keysByFilter.values()) {
    const filter = group[0].filter;
    // The IN lists form a cross product (site A x path from site B); surplus
    // rows are harmless and simply never looked up below.
    const rows = loadPageMetrics({
      db,
      siteIds: unique(group.map((key) => key.siteId)),
      paths: unique(group.map((key) => key.path)),
      filter,
    });
    for (const row of rows) {
      const key = pageKey({ siteId: row.siteId, path: row.path, filter });
      rowsByPage.set(key, [...(rowsByPage.get(key) ?? []), row]);
    }
  }

  return keys.map((key) => rowsByPage.get(pageKey(key)) ?? []);
};
