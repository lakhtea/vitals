// The GraphQL schema: object types, root queries, mutations, and the data
// access behind them. builder.toSchema() at the bottom is where Pothos emits a
// graphql-js schema.
import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { listLatestChecksForSite } from "@/db/queries/checks";
import { decideIncident, getIncident, listIncidentsForSite } from "@/db/queries/incidents";
import { loadSiteMetrics } from "@/db/queries/metrics";
import { type PageAggregate, listPagesForSite } from "@/db/queries/pages";
import { listSessionsForSite } from "@/db/queries/sessions";
import { type IncidentRow, type SiteRow, sites } from "@/db/schema";
import { detectIncidents } from "@/incidents/detect";
import type { HumanDecision } from "@/incidents/vocabulary";
import { builder } from "./builder";
import type { Context } from "./context";
import { IncidentStatusEnum } from "./enums";
import { toTrafficFilter, TrafficFilterInput } from "./inputs";
import { batchLoadPageMetrics, pageMetricsCacheKey, type PageMetricsKey } from "./loaders/page-metrics";
import "./scalars";
import { CheckType } from "./types/checks";
import { DetectionResultType, IncidentType } from "./types/incidents";
import { MetricSummaryType } from "./types/metrics";
import { SessionType } from "./types/sessions";

const DEFAULT_SESSIONS_LIMIT = 50;
const MAX_SESSIONS_LIMIT = 500;
const MAX_INCIDENTS_LIMIT = 100;

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
      description: "Per-metric percentiles for this path; pass the same filter you gave `pages`.",
      args: { filter: t.arg({ type: TrafficFilterInput }) },
      // DataLoader collects every page's key during one tick and calls `load`
      // once; the batch runs one SQL statement per distinct time range.
      // DataLoader insists on a Promise even though better-sqlite3 is synchronous.
      loaderOptions: { cacheKeyFn: pageMetricsCacheKey },
      load: (keys: PageMetricsKey[], ctx) => Promise.resolve(batchLoadPageMetrics({ db: ctx.db, keys })),
      resolve: (page, args) => ({ siteId: page.siteId, path: page.path, filter: toTrafficFilter(args.filter) }),
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
      description: "Paths with traffic, most viewed first.",
      args: { filter: t.arg({ type: TrafficFilterInput }) },
      resolve: (site, args, ctx) => listPagesForSite({ db: ctx.db, siteId: site.id, filter: toTrafficFilter(args.filter) }),
    }),
    metrics: t.field({
      type: [MetricSummaryType],
      description: "Site-wide rollup across every path.",
      args: { filter: t.arg({ type: TrafficFilterInput }) },
      resolve: (site, args, ctx) =>
        loadSiteMetrics({ db: ctx.db, siteIds: [site.id], filter: toTrafficFilter(args.filter) }),
    }),
    sessions: t.field({
      type: [SessionType],
      description: "Most recent sessions first.",
      args: { filter: t.arg({ type: TrafficFilterInput }), limit: t.arg.int({ defaultValue: DEFAULT_SESSIONS_LIMIT }) },
      resolve: (site, args, ctx) => {
        const limit = args.limit ?? DEFAULT_SESSIONS_LIMIT;
        // SQLite reads a negative LIMIT as "no limit", which would silently bypass the cap.
        if (limit < 0) {
          throw new GraphQLError(`sessions.limit must not be negative (got ${limit})`);
        }
        return listSessionsForSite({
          db: ctx.db,
          siteId: site.id,
          limit: Math.min(limit, MAX_SESSIONS_LIMIT),
          filter: toTrafficFilter(args.filter),
        });
      },
    }),
    checks: t.field({
      type: [CheckType],
      description: "Every check the site's applications have reported, at its latest observation, worst status first.",
      resolve: (site, _args, ctx) => listLatestChecksForSite({ db: ctx.db, siteId: site.id }),
    }),
    incidents: t.field({
      type: [IncidentType],
      description: `Newest first, at most ${MAX_INCIDENTS_LIMIT}; pass a status to narrow.`,
      args: { status: t.arg({ type: IncidentStatusEnum }) },
      resolve: (site, args, ctx) =>
        listIncidentsForSite({ db: ctx.db, siteId: site.id, status: args.status ?? null, limit: MAX_INCIDENTS_LIMIT }),
    }),
  }),
});

const siteExists = ({ db, siteId }: { db: Context["db"]; siteId: string }): boolean =>
  db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get() !== undefined;

// An ID arrives as a string; an incident id is an integer row id, and anything
// else names no incident rather than being an error.
const parseIncidentId = (id: string | number): number | null => {
  const text = String(id);
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/** A blank note is no note: the step's detail and the incident's note both read null. */
const normaliseNote = (note: string | null | undefined): string | null => {
  const trimmed = note?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

const applyHumanDecision = ({
  ctx,
  id,
  decision,
  note,
}: {
  ctx: Context;
  id: string | number;
  decision: HumanDecision;
  note: string | null | undefined;
}): IncidentRow => {
  const incidentId = parseIncidentId(id);
  if (incidentId === null) {
    throw new GraphQLError(`No incident with id "${id}"`);
  }
  const result = decideIncident({ db: ctx.db, id: incidentId, decision, note: normaliseNote(note), now: Date.now() });
  if (!result.ok) {
    if (result.reason === "not-found") {
      throw new GraphQLError(`No incident with id "${id}"`);
    }
    throw new GraphQLError(`Incident ${id} cannot move from "${result.from}" to "${result.to}"`);
  }
  return result.incident;
};

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
    args: { siteId: t.arg.id({ required: true }), filter: t.arg({ type: TrafficFilterInput }) },
    resolve: (_root, args, ctx) =>
      listPagesForSite({ db: ctx.db, siteId: String(args.siteId), filter: toTrafficFilter(args.filter) }),
  }),
  incident: t.field({
    type: IncidentType,
    nullable: true,
    description: "One incident by id, with its evidence and steps; null when no incident has that id.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) => {
      const incidentId = parseIncidentId(args.id);
      return incidentId === null ? null : (getIncident({ db: ctx.db, id: incidentId }) ?? null);
    },
  }),
}));

builder.mutationFields((t) => ({
  detectIncidents: t.field({
    type: DetectionResultType,
    description: "Run the deterministic detector for one site now. Idempotent: a second run on the same data changes nothing.",
    args: { siteId: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) => {
      const siteId = String(args.siteId);
      if (!siteExists({ db: ctx.db, siteId })) {
        throw new GraphQLError(`No site with id "${siteId}"`);
      }
      return detectIncidents({ db: ctx.db, siteId, now: Date.now() });
    },
  }),
  approveIncident: t.field({
    type: IncidentType,
    description: "A human confirms the incident is real and worth fixing. Allowed from any live status; refused once decided or resolved.",
    args: { id: t.arg.id({ required: true }), note: t.arg.string() },
    resolve: (_root, args, ctx) => applyHumanDecision({ ctx, id: args.id, decision: "approved", note: args.note }),
  }),
  dismissIncident: t.field({
    type: IncidentType,
    description: "A human closes the incident as noise or not worth acting on. Allowed from any live status; refused once decided or resolved.",
    args: { id: t.arg.id({ required: true }), note: t.arg.string() },
    resolve: (_root, args, ctx) => applyHumanDecision({ ctx, id: args.id, decision: "dismissed", note: args.note }),
  }),
}));

export const schema = builder.toSchema();
