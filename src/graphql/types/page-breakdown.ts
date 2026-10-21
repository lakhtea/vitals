// PageBreakdown: one page's metrics split per device class and per connection
// type, each slice carrying the same MetricSummary shape Page.metrics returns,
// so the detail view renders a slice with the components it already has.
import type { Db } from "@/db";
import { type DimensionSlice, loadPageBreakdown } from "@/db/queries/breakdown";
import type { TrafficFilter } from "@/db/queries/filter";
import type { MetricSummaryRow } from "@/db/queries/metrics";
import { builder } from "../builder";
import { CONNECTION_TYPE_ENUM_VALUES, DEVICE_CLASS_ENUM_VALUES, enumNameOf } from "../enums";
import { MetricSummaryType } from "./metrics";

interface PageBreakdownRow {
  value: string;
  metrics: MetricSummaryRow[];
}

interface PageBreakdown {
  byDevice: PageBreakdownRow[];
  byConnection: PageBreakdownRow[];
}

const PageBreakdownRowType = builder.objectRef<PageBreakdownRow>("PageBreakdownRow").implement({
  description: "One device class or connection type and what the page's metrics look like for it.",
  fields: (t) => ({
    value: t.exposeString("value", { description: "DeviceClass or ConnectionType value, e.g. MOBILE or FOUR_G." }),
    metrics: t.field({
      type: [MetricSummaryType],
      description: "One summary per metric that had samples in this slice.",
      resolve: (row) => row.metrics,
    }),
  }),
});

export const PageBreakdownType = builder.objectRef<PageBreakdown>("PageBreakdown").implement({
  description: "Per device class and per connection type; values with no samples are omitted.",
  fields: (t) => ({
    byDevice: t.field({ type: [PageBreakdownRowType], resolve: (breakdown) => breakdown.byDevice }),
    byConnection: t.field({ type: [PageBreakdownRowType], resolve: (breakdown) => breakdown.byConnection }),
  }),
});

/** The wire spelling for each slice's value; the order is the one the query module chose. */
const toRows = (
  slices: DimensionSlice<string>[],
  values: Readonly<Record<string, { readonly value: string }>>,
): PageBreakdownRow[] => slices.map((slice) => ({ value: enumNameOf(values, slice.value), metrics: slice.metrics }));

export const resolvePageBreakdown = ({
  db,
  siteId,
  path,
  filter,
}: {
  db: Db;
  siteId: string;
  path: string;
  filter: TrafficFilter;
}): PageBreakdown => {
  const data = loadPageBreakdown({ db, siteId, path, filter });
  return {
    byDevice: toRows(data.byDevice, DEVICE_CLASS_ENUM_VALUES),
    byConnection: toRows(data.byConnection, CONNECTION_TYPE_ENUM_VALUES),
  };
};
