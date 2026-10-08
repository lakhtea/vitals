import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const STAGES = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type Stage = (typeof STAGES)[number];

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  url: text("url"),
  stage: text("stage", { enum: STAGES }).notNull().default("saved"),
  notes: text("notes"),
  /** ISO date (YYYY-MM-DD) — next follow-up action for this application. */
  followUpOn: text("follow_up_on"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  notes: text("notes"),
});
