// The GraphQL schema: object types, root queries, and the data access behind
// them. builder.toSchema() at the bottom is where Pothos emits a graphql-js schema.
import { eq } from "drizzle-orm";
import { loadSiteMetrics } from "@/db/queries/metrics";
import { type PageAggregate, listPagesForSite } from "@/db/queries/pages";
import { listSessionsForSite } from "@/db/queries/sessions";
import { type SiteRow, sites } from "@/db/schema";
import { builder } from "./builder";
import { batchLoadPageMetrics, pageMetricsCacheKey, type PageMetricsKey } from "./loaders/page-metrics";
import "./scalars";
import { MetricSummaryType, toTimeRange } from "./types/metrics";
import { SessionType } from "./types/sessions";

const DEFAULT_SESSIONS_LIMIT = 50;
const MAX_SESSIONS_LIMIT = 500;

// A Page is an aggregate over pageviews, not a stored row, so it has no id of
// its own; Apollo keeps it nested under its parent Site in the cache.
const PageType = builder.objectRef<PageAggregate>("Page").implement({
  description: "Traffic for one URL path, aggregated over its pageviews.",
  fields: (t) => ({
    path: t.exposeString("path"),
    pageviewCount: t.exposeInt("pageviewCount"),
    eventCount: t.exposeInt("eventCount", { description: "Metric events recorded on this path." }),
    metrics: t.loadableList({
      type: MetricSummaryType,
      description: "Per-metric percentiles for this path, optionally within [from, to).",
      args: { from: t.arg({ type: "DateTime" }), to: t.arg({ type: "DateTime" }) },
      // DataLoader collects every page's key during one tick and calls `load`
      // once; the batch runs one SQL statement per distinct time range.
      // DataLoader insists on a Promise even though better-sqlite3 is synchronous.
      loaderOptions: { cacheKeyFn: pageMetricsCacheKey },
      load: (keys: PageMetricsKey[], ctx) => Promise.resolve(batchLoadPageMetrics({ db: ctx.db, keys })),
      resolve: (page, args) => ({ siteId: page.siteId, path: page.path, range: toTimeRange(args) }),
    }),
  }),
});

const SiteType = builder.objectRef<SiteRow>("Site").implement({
  description: "A property being measured.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    createdAt: t.field({ type: "DateTime", resolve: (site) => site.createdAt }),
    pages: t.field({
      type: [PageType],
      resolve: (site, _args, ctx) => listPagesForSite({ db: ctx.db, siteId: site.id }),
    }),
    metrics: t.field({
      type: [MetricSummaryType],
      description: "Site-wide rollup across every path, optionally within [from, to).",
      args: { from: t.arg({ type: "DateTime" }), to: t.arg({ type: "DateTime" }) },
      resolve: (site, args, ctx) => loadSiteMetrics({ db: ctx.db, siteIds: [site.id], range: toTimeRange(args) }),
    }),
    sessions: t.field({
      type: [SessionType],
      description: "Most recent sessions first.",
      args: { limit: t.arg.int({ defaultValue: DEFAULT_SESSIONS_LIMIT }) },
      resolve: (site, args, ctx) =>
        listSessionsForSite({
          db: ctx.db,
          siteId: site.id,
          limit: Math.min(args.limit ?? DEFAULT_SESSIONS_LIMIT, MAX_SESSIONS_LIMIT),
        }),
    }),
  }),
});

builder.queryFields((t) => ({
  sites: t.field({
    type: [SiteType],
    resolve: (_root, _args, ctx) => ctx.db.select().from(sites).orderBy(sites.name).all(),
  }),
  site: t.field({
    type: SiteType,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) =>
      ctx.db.select().from(sites).where(eq(sites.id, String(args.id))).get() ?? null,
  }),
  pages: t.field({
    type: [PageType],
    args: { siteId: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) => listPagesForSite({ db: ctx.db, siteId: String(args.siteId) }),
  }),
}));

export const schema = builder.toSchema();
