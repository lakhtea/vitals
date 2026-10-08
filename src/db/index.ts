import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Create a database handle. Pass ":memory:" in tests for an isolated instance.
 *
 * TODO(session): replace the inline bootstrap DDL with drizzle-kit generated
 * migrations once the schema stabilizes (drizzle.config.ts is already set up).
 */
export function makeDb(url = process.env.PIPELINE_DB_PATH ?? ".data/pipeline.db"): Db {
  if (url !== ":memory:") {
    mkdirSync(dirname(url), { recursive: true });
  }
  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      url TEXT,
      stage TEXT NOT NULL DEFAULT 'saved',
      notes TEXT,
      follow_up_on TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id),
      name TEXT NOT NULL,
      role TEXT,
      email TEXT,
      notes TEXT
    );
  `);
  return drizzle(sqlite, { schema });
}

/** Shared app-wide handle (dev/prod). Tests should call makeDb(":memory:") instead. */
export const db: Db = makeDb();
