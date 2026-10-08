// Opens the SQLite database, applies pending migrations from ./drizzle, and
// hands back a typed Drizzle handle. makeDb(":memory:") gives tests an isolated
// database; getDb() is the lazily created shared handle the app uses.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Logger } from "drizzle-orm/logger";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const DEFAULT_DB_PATH = ".data/vitals.db";
const MIGRATIONS_FOLDER = resolve(process.cwd(), "drizzle");

export const resolveDbPath = (): string => process.env.VITALS_DB_PATH ?? DEFAULT_DB_PATH;

export interface MakeDbOptions {
  /** Receives every executed statement; tests pass a QueryCounter's logger. */
  logger?: Logger;
}

export const makeDb = (url: string = resolveDbPath(), { logger }: MakeDbOptions = {}): Db => {
  if (url !== ":memory:") {
    mkdirSync(dirname(url), { recursive: true });
  }
  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema, logger });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
};

let sharedDb: Db | null = null;

export const getDb = (): Db => {
  if (sharedDb === null) {
    sharedDb = makeDb();
  }
  return sharedDb;
};
