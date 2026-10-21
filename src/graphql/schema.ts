// The GraphQL schema: object types, root queries, mutations, and the data
// access behind them. builder.toSchema() at the bottom is where Pothos emits a
// graphql-js schema.
import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { listLatestChecksForSite } from "@/db/queries/checks";
import { editFixRevision, submitFixRevision } from "@/db/queries/fix-revisions";
import { type DecisionResult, decideIncident, getIncident, listIncidentsForSite, transitionIncident } from "@/db/queries/incidents";
import { loadSiteMetrics } from "@/db/queries/metrics";
import { getPageForSite, type PageAggregate, listPagesForSite } from "@/db/queries/pages";
import { listSessionsForSite } from "@/db/queries/sessions";
import { recordStep } from "@/db/queries/steps";
import { type IncidentRow, type SiteRow, sites } from "@/db/schema";
import { detectIncidents } from "@/incidents/detect";
import type { HumanDecision } from "@/incidents/vocabulary";
import { builder } from "./builder";
import { type Context, requireService } from "./context";
import { IncidentStatusEnum, SeriesBucketEnum, StepRoleEnum, StepStatusEnum } from "./enums";
import { FixFileEdit, FixFileInput, StepUsageInput, toStepUsage, toTrafficFilter, TrafficFilterInput } from "./inputs";
import { batchLoadPageMetrics, pageMetricsCacheKey, type PageMetricsKey } from "./loaders/page-metrics";
import "./scalars";
import { CheckType } from "./types/checks";
import { FixRevisionType } from "./types/fix-revisions";
import { DetectionResultType, IncidentStepType, IncidentType } from "./types/incidents";
import { MetricSummaryType } from "./types/metrics";
import { PageBreakdownType, resolvePageBreakdown } from "./types/page-breakdown";
import { MetricSeriesType, resolveMetricSeries } from "./types/series";
import { SessionType } from "./types/sessions";

const DEFAULT_SESSIONS_LIMIT = 50;
const MAX_SESSIONS_LIMIT = 500;
const MAX_INCIDENTS_LIMIT = 100;

/** The limit a sessions list will actually use: capped, and refused when negative. */
const clampSessionsLimit = (limit: number | null | undefined): number => {
  const requested = limit ?? DEFAULT_SESSIONS_LIMIT;
  // SQLite reads a negative LIMIT as "no limit", which would silently bypass the cap.
  if (requested < 0) {
    throw new GraphQLError(`sessions.limit must not be negative (got ${requested})`);
  }
  return Math.min(requested, MAX_SESSIONS_LIMIT);
};

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
    series: t.field({
      type: [MetricSeriesType],
      description: "p75 per bucket for every metric on this path; one statement for all five metrics.",
      args: { filter: t.arg({ type: TrafficFilterInput }), bucket: t.arg({ type: SeriesBucketEnum, required: true }) },
      resolve: (page, args, ctx) =>
        resolveMetricSeries({
          db: ctx.db,
          siteId: page.siteId,
          path: page.path,
          filter: toTrafficFilter(args.filter),
          bucket: args.bucket,
        }),
    }),
    sessions: t.field({
      type: [SessionType],
      description: "Sessions that visited this path, most recent first.",
      args: { filter: t.arg({ type: TrafficFilterInput }), limit: t.arg.int({ defaultValue: DEFAULT_SESSIONS_LIMIT }) },
      resolve: (page, args, ctx) =>
        listSessionsForSite({
          db: ctx.db,
          siteId: page.siteId,
          path: page.path,
          limit: clampSessionsLimit(args.limit),
          filter: toTrafficFilter(args.filter),
        }),
    }),
    breakdown: t.field({
      type: PageBreakdownType,
      description: "p75 per metric per device class and per connection type, for this path. Two statements, so ask for it on the detail view, not the list.",
      args: { filter: t.arg({ type: TrafficFilterInput }) },
      resolve: (page, args, ctx) =>
        resolvePageBreakdown({ db: ctx.db, siteId: page.siteId, path: page.path, filter: toTrafficFilter(args.filter) }),
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
    page: t.field({
      type: PageType,
      nullable: true,
      description: "One page by its exact path, or null when the site has no traffic on it under the filter.",
      args: { path: t.arg.string({ required: true }), filter: t.arg({ type: TrafficFilterInput }) },
      resolve: (site, args, ctx) =>
        getPageForSite({ db: ctx.db, siteId: site.id, path: args.path, filter: toTrafficFilter(args.filter) }),
    }),
    series: t.field({
      type: [MetricSeriesType],
      description: "p75 per bucket for every metric, site-wide; one statement for all five metrics.",
      args: { filter: t.arg({ type: TrafficFilterInput }), bucket: t.arg({ type: SeriesBucketEnum, required: true }) },
      resolve: (site, args, ctx) =>
        resolveMetricSeries({
          db: ctx.db,
          siteId: site.id,
          path: null,
          filter: toTrafficFilter(args.filter),
          bucket: args.bucket,
        }),
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
      resolve: (site, args, ctx) =>
        listSessionsForSite({
          db: ctx.db,
          siteId: site.id,
          limit: clampSessionsLimit(args.limit),
          filter: toTrafficFilter(args.filter),
        }),
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

// An ID arrives as a string; incident and revision ids are integer row ids, and
// anything else names no row rather than being an error.
const parseRowId = (id: string | number): number | null => {
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

/** The message a person sees when a decision is refused. */
const decisionRefusal = ({ id, result }: { id: string | number; result: Exclude<DecisionResult, { ok: true }> }): string => {
  switch (result.reason) {
    case "not-found":
      return `No incident with id "${id}"`;
    case "illegal-transition":
      return `Incident ${id} cannot move from "${result.from}" to "${result.to}"`;
    case "revision-required":
      return `Incident ${id} has a proposed fix; approve it by passing revisionId for revision ${result.latestNumber}, the latest`;
    case "no-revisions":
      return `Incident ${id} has no proposed fix, so approving it takes no revisionId`;
    case "revision-not-found":
      return `No fix revision with id "${result.revisionId}"`;
    case "foreign-revision":
      return `Revision ${result.number} belongs to another incident; incident ${id}'s latest revision is ${result.latestNumber}`;
    case "stale-revision":
      return `Revision ${result.number} is not the latest; review revision ${result.latestNumber} before approving`;
  }
};

const applyHumanDecision = ({
  ctx,
  id,
  decision,
  note,
  revisionId = null,
}: {
  ctx: Context;
  id: string | number;
  decision: HumanDecision;
  note: string | null | undefined;
  revisionId?: string | number | null;
}): IncidentRow => {
  const incidentId = parseRowId(id);
  if (incidentId === null) {
    throw new GraphQLError(`No incident with id "${id}"`);
  }
  // An unparseable revision id names no revision; -1 keeps that refusal in one place, the query module.
  const pinnedId = revisionId === null ? null : (parseRowId(revisionId) ?? -1);
  const result = decideIncident({
    db: ctx.db,
    id: incidentId,
    decision,
    note: normaliseNote(note),
    revisionId: pinnedId,
    now: Date.now(),
  });
  if (!result.ok) {
    throw new GraphQLError(decisionRefusal({ id, result }));
  }
  return result.incident;
};

/** An id that names no incident is an error for a write, where the read field would return null. */
const requireIncidentId = (id: string | number): number => {
  const incidentId = parseRowId(id);
  if (incidentId === null) {
    throw new GraphQLError(`No incident with id "${id}"`);
  }
  return incidentId;
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
      const incidentId = parseRowId(args.id);
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
    description:
      "A human confirms the incident is real and worth fixing. Allowed from any live status; refused once decided or resolved. When the incident has a proposed fix, revisionId is required and must be its latest revision, which the approval pins; when it has none, revisionId must be absent.",
    args: { id: t.arg.id({ required: true }), note: t.arg.string(), revisionId: t.arg.id() },
    resolve: (_root, args, ctx) =>
      applyHumanDecision({ ctx, id: args.id, decision: "approved", note: args.note, revisionId: args.revisionId ?? null }),
  }),
  dismissIncident: t.field({
    type: IncidentType,
    description: "A human closes the incident as noise or not worth acting on. Allowed from any live status; refused once decided or resolved.",
    args: { id: t.arg.id({ required: true }), note: t.arg.string() },
    resolve: (_root, args, ctx) => applyHumanDecision({ ctx, id: args.id, decision: "dismissed", note: args.note }),
  }),
  recordStep: t.field({
    type: IncidentStepType,
    description:
      "An agent appends one step to an incident's timeline. Needs the service token. Refused for role HUMAN (people decide through approveIncident and dismissIncident) and for a dismissed or resolved incident.",
    args: {
      incidentId: t.arg.id({ required: true }),
      role: t.arg({ type: StepRoleEnum, required: true }),
      status: t.arg({ type: StepStatusEnum, required: true }),
      summary: t.arg.string({ required: true, description: "One line, 1 to 300 characters after trimming." }),
      detail: t.arg.string({ description: "The long form, at most 20,000 characters." }),
      startedAt: t.arg({ type: "DateTime", description: "Defaults to now." }),
      finishedAt: t.arg({ type: "DateTime", description: "Must not be before startedAt." }),
      usage: t.arg({ type: StepUsageInput }),
      link: t.arg.string({ description: "An http(s) URL: the PR, a trace, a commit." }),
    },
    resolve: (_root, args, ctx) => {
      requireService(ctx);
      const id = String(args.incidentId);
      const result = recordStep({
        db: ctx.db,
        input: {
          incidentId: requireIncidentId(id),
          role: args.role,
          status: args.status,
          summary: args.summary,
          detail: args.detail ?? null,
          startedAt: args.startedAt ?? null,
          finishedAt: args.finishedAt ?? null,
          usage: toStepUsage(args.usage),
          link: args.link ?? null,
        },
        now: Date.now(),
      });
      if (result.ok) {
        return result.step;
      }
      switch (result.reason) {
        case "human-role":
          throw new GraphQLError("Agents cannot record HUMAN steps; a person decides through approveIncident or dismissIncident");
        case "invalid":
          throw new GraphQLError(result.message);
        case "not-found":
          throw new GraphQLError(`No incident with id "${id}"`);
        case "terminal":
          throw new GraphQLError(`Incident ${id} is "${result.status}"; a closed incident takes no more steps`);
      }
    },
  }),
  transitionIncident: t.field({
    type: IncidentType,
    description:
      "An agent moves an incident one stage along OPEN -> TRIAGED -> FIX_PROPOSED -> REVIEWED -> AWAITING_HUMAN. Needs the service token. Refused for any other target and for skipping a stage.",
    args: { id: t.arg.id({ required: true }), to: t.arg({ type: IncidentStatusEnum, required: true }) },
    resolve: (_root, args, ctx) => {
      requireService(ctx);
      const id = String(args.id);
      const result = transitionIncident({ db: ctx.db, id: requireIncidentId(id), to: args.to, now: Date.now() });
      if (result.ok) {
        return result.incident;
      }
      switch (result.reason) {
        case "not-agent-target":
          throw new GraphQLError(
            `Agents cannot move an incident to "${result.to}": approving and dismissing belong to a person, opening and resolving to the detector`,
          );
        case "not-found":
          throw new GraphQLError(`No incident with id "${id}"`);
        case "illegal-transition":
          throw new GraphQLError(`Incident ${id} cannot move from "${result.from}" to "${result.to}"`);
      }
    },
  }),
  submitFixRevision: t.field({
    type: FixRevisionType,
    description:
      "An agent proposes a change. Needs the service token. The incident must be live (not dismissed, resolved, or approved).",
    args: {
      incidentId: t.arg.id({ required: true }),
      targetRepo: t.arg.string({ required: true, description: '"owner/name" of the repository.' }),
      baseSha: t.arg.string({ required: true, description: "The commit the before contents were read at." }),
      summary: t.arg.string({ required: true }),
      files: t.arg({ type: [FixFileInput], required: true, description: "1 to 20 files, each content at most 200,000 UTF-8 bytes." }),
    },
    resolve: (_root, args, ctx) => {
      requireService(ctx);
      const id = String(args.incidentId);
      const result = submitFixRevision({
        db: ctx.db,
        input: {
          incidentId: requireIncidentId(id),
          targetRepo: args.targetRepo,
          baseSha: args.baseSha,
          summary: args.summary,
          files: args.files.map((file) => ({
            path: file.path,
            action: file.action,
            before: file.beforeContent ?? null,
            after: file.afterContent ?? null,
          })),
        },
        now: Date.now(),
      });
      if (result.ok) {
        return result.revision;
      }
      switch (result.reason) {
        case "invalid":
          throw new GraphQLError(result.message);
        case "not-found":
          throw new GraphQLError(`No incident with id "${id}"`);
        case "not-live":
          throw new GraphQLError(`Incident ${id} is "${result.status}"; a fix can only be proposed while it is live`);
      }
    },
  }),
  editFixRevision: t.field({
    type: FixRevisionType,
    description:
      'A person edits the latest revision\'s new contents; writes a new HUMAN revision (unchanged files copied) and a HUMAN step "Edited the proposed change (revision N)" with the note as detail. Only ADD and MODIFY files can be edited, only the incident\'s latest revision, only while the incident is live and not approved. Refused when nothing changed.',
    args: {
      revisionId: t.arg.id({ required: true }),
      files: t.arg({ type: [FixFileEdit], required: true }),
      note: t.arg.string(),
    },
    resolve: (_root, args, ctx) => {
      const id = String(args.revisionId);
      const revisionId = parseRowId(id);
      if (revisionId === null) {
        throw new GraphQLError(`No fix revision with id "${id}"`);
      }
      const result = editFixRevision({
        db: ctx.db,
        revisionId,
        edits: args.files.map((file) => ({ path: file.path, after: file.afterContent })),
        note: normaliseNote(args.note),
        now: Date.now(),
      });
      if (result.ok) {
        return result.revision;
      }
      switch (result.reason) {
        case "not-found":
          throw new GraphQLError(`No fix revision with id "${id}"`);
        case "not-live":
          throw new GraphQLError(`The incident is "${result.status}"; its proposed fix can no longer be edited`);
        case "stale":
          throw new GraphQLError(
            `Revision ${result.number} is not the latest; edit revision ${result.latestNumber} instead`,
          );
        case "invalid":
          throw new GraphQLError(result.message);
        case "unchanged":
          throw new GraphQLError("Nothing changed: the edit matches the revision it started from");
      }
    },
  }),
}));

export const schema = builder.toSchema();
