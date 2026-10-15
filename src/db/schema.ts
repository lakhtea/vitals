// The tables of the RUM domain, declared once so Drizzle derives both the SQL
// (through drizzle-kit migrations in ./drizzle) and the row types from them.
// Four carry traffic (sites, sessions, pageviews, metric_events); three carry
// operations (checks, incidents, incident_steps, from M12); two carry proposed
// fixes (fix_revisions, fix_revision_files, from M14). All timestamps are
// integer milliseconds since the Unix epoch, UTC.
import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { CHECK_STATUSES } from "../checks/status";
import type { IncidentEvidence } from "../incidents/evidence";
import { FILE_ACTIONS, FIX_AUTHORS } from "../incidents/fix";
import {
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
  STEP_ROLES,
  STEP_STATUSES,
  TERMINAL_INCIDENT_STATUSES,
} from "../incidents/vocabulary";
import { CONNECTION_TYPES, DEVICE_CLASSES } from "../vitals/dimensions";
import { METRIC_NAMES, METRIC_RATINGS } from "../vitals/metrics";

export const sites = sqliteTable("sites", {
  /** The public key the browser library sends as `siteId`: a slug, not a secret. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  /**
   * The shared secret an application presents to POST /api/checks. Browsers
   * post vitals without one (a key in a web page is public anyway); servers
   * reporting health must hold it. Null means the site accepts no checks.
   */
  writeKey: text("write_key"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** Generated in the browser, so retried deliveries agree on identity. */
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    startedAt: integer("started_at").notNull(),
    deviceClass: text("device_class", { enum: DEVICE_CLASSES }).notNull(),
    connectionType: text("connection_type", { enum: CONNECTION_TYPES }).notNull(),
    userAgentFamily: text("user_agent_family").notNull(),
  },
  (table) => [index("sessions_site_started_idx").on(table.siteId, table.startedAt)],
);

export const pageviews = sqliteTable(
  "pageviews",
  {
    /** Generated in the browser once per navigation. */
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    path: text("path").notNull(),
    startedAt: integer("started_at").notNull(),
  },
  (table) => [
    index("pageviews_session_idx").on(table.sessionId),
    index("pageviews_path_idx").on(table.path),
  ],
);

export const metricEvents = sqliteTable(
  "metric_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pageviewId: text("pageview_id")
      .notNull()
      .references(() => pageviews.id),
    /** web-vitals' per-instance id; with pageview + name it makes delivery idempotent. */
    metricId: text("metric_id").notNull(),
    name: text("name", { enum: METRIC_NAMES }).notNull(),
    value: real("value").notNull(),
    rating: text("rating", { enum: METRIC_RATINGS }).notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    uniqueIndex("metric_events_dedupe_idx").on(table.pageviewId, table.name, table.metricId),
    index("metric_events_name_recorded_idx").on(table.name, table.recordedAt),
  ],
);

/**
 * One health-check observation pushed by an application: "api-latency-p95 was
 * degraded at 412 ms at 10:04". The latest row per (site, check) is the
 * check's current status; the history is what the detector and the detail
 * page read.
 */
export const checks = sqliteTable(
  "checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    /** The application's own stable identifier for the check, e.g. "api-latency-p95". */
    checkId: text("check_id").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: CHECK_STATUSES }).notNull(),
    value: real("value"),
    unit: text("unit"),
    observedAt: integer("observed_at").notNull(),
    detail: text("detail"),
  },
  (table) => [
    // The same observation delivered twice (a retry) is a no-op, as for metric events.
    uniqueIndex("checks_dedupe_idx").on(table.siteId, table.checkId, table.observedAt),
  ],
);

/**
 * Something the detector decided a human should look at: a vitals regression
 * on one path and metric, or a health check that is failing. One live
 * incident per subject at a time; the partial unique index below enforces it
 * at the database, the detector checks it first so the error path is never hit.
 */
export const incidents = sqliteTable(
  "incidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    source: text("source", { enum: INCIDENT_SOURCES }).notNull(),
    /** The path for a vitals regression, the check id for a health check. */
    subject: text("subject").notNull(),
    /** The metric for a vitals regression; null for a health check. */
    metric: text("metric", { enum: METRIC_NAMES }),
    status: text("status", { enum: INCIDENT_STATUSES }).notNull(),
    detectedAt: integer("detected_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    resolvedAt: integer("resolved_at"),
    /** Why the incident exists; shape per source, see src/incidents/evidence.ts. */
    evidence: text("evidence", { mode: "json" }).$type<IncidentEvidence>().notNull(),
    /** The human's note when approving or dismissing. */
    note: text("note"),
    /**
     * The fix revision a person approved, pinned so the change that ships is
     * the one they read, not whatever an agent submits afterwards. Null when
     * not approved, or approved with no proposed fix.
     */
    approvedRevisionId: integer("approved_revision_id").references((): AnySQLiteColumn => fixRevisions.id),
  },
  (table) => [
    index("incidents_site_detected_idx").on(table.siteId, table.detectedAt),
    uniqueIndex("incidents_one_live_per_subject_idx")
      .on(table.siteId, table.source, table.subject, table.metric)
      // SQLite forbids bound parameters in a partial index, so the list is spliced in as literals.
      .where(sql.raw(`status NOT IN (${TERMINAL_INCIDENT_STATUSES.map((status) => `'${status}'`).join(", ")})`)),
  ],
);

/**
 * The record of who did what to an incident: each agent's work (from M15) and
 * each human decision, in order. The detail page renders this as the evidence
 * trail; the cost and token columns are what the README's per-incident
 * numbers will be measured from.
 */
export const incidentSteps = sqliteTable(
  "incident_steps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id),
    role: text("role", { enum: STEP_ROLES }).notNull(),
    status: text("status", { enum: STEP_STATUSES }).notNull(),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    /** One line a human can read in the timeline. */
    summary: text("summary").notNull(),
    /** The long form: what the agent saw and concluded, or the human's note. */
    detail: text("detail"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: real("cost_usd"),
    /** A URL to follow: the PR, a trace, a commit. */
    link: text("link"),
  },
  (table) => [index("incident_steps_incident_started_idx").on(table.incidentId, table.startedAt)],
);

/**
 * One immutable version of the change proposed for an incident. An agent
 * submits revision 1; every human edit writes the next number rather than
 * changing a row, so the history shows who changed what and an approval can
 * pin exactly the version a person read.
 */
export const fixRevisions = sqliteTable(
  "fix_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id),
    /** 1-based per incident, in the order revisions were written. */
    number: integer("number").notNull(),
    author: text("author", { enum: FIX_AUTHORS }).notNull(),
    createdAt: integer("created_at").notNull(),
    /** "owner/name" of the repository the change applies to. */
    targetRepo: text("target_repo").notNull(),
    /** The commit the before contents were read at; a patch only applies against its base. */
    baseSha: text("base_sha").notNull(),
    summary: text("summary").notNull(),
  },
  (table) => [uniqueIndex("fix_revisions_incident_number_idx").on(table.incidentId, table.number)],
);

/**
 * One file a revision touches, stored as whole before and after contents; the
 * unified diff is derived from them on read (src/incidents/diff.ts).
 */
export const fixRevisionFiles = sqliteTable(
  "fix_revision_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    revisionId: integer("revision_id")
      .notNull()
      .references(() => fixRevisions.id),
    /** Relative to the repository root, forward slashes, no "..". */
    path: text("path").notNull(),
    action: text("action", { enum: FILE_ACTIONS }).notNull(),
    /** Null for an added file. */
    beforeContent: text("before_content"),
    /** Null for a deleted file. */
    afterContent: text("after_content"),
  },
  (table) => [uniqueIndex("fix_revision_files_revision_path_idx").on(table.revisionId, table.path)],
);

export type SiteRow = typeof sites.$inferSelect;
export type CheckRow = typeof checks.$inferSelect;
export type CheckInsert = typeof checks.$inferInsert;
export type IncidentRow = typeof incidents.$inferSelect;
export type IncidentInsert = typeof incidents.$inferInsert;
export type IncidentStepRow = typeof incidentSteps.$inferSelect;
export type IncidentStepInsert = typeof incidentSteps.$inferInsert;
export type FixRevisionRow = typeof fixRevisions.$inferSelect;
export type FixRevisionFileRow = typeof fixRevisionFiles.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type PageviewInsert = typeof pageviews.$inferInsert;
export type MetricEventInsert = typeof metricEvents.$inferInsert;
