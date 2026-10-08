// The four tables of the RUM domain, declared once so Drizzle derives both the
// SQL (through drizzle-kit migrations in ./drizzle) and the row types from them.
// All timestamps are integer milliseconds since the Unix epoch, UTC.
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { CONNECTION_TYPES, DEVICE_CLASSES } from "../vitals/dimensions";
import { METRIC_NAMES, METRIC_RATINGS } from "../vitals/metrics";

export const sites = sqliteTable("sites", {
  /** The public key the browser library sends as `siteId`: a slug, not a secret. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
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

export type SiteRow = typeof sites.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type PageviewInsert = typeof pageviews.$inferInsert;
export type MetricEventInsert = typeof metricEvents.$inferInsert;
