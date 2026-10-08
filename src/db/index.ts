// Opens the SQLite database, applies pending migrations from ./drizzle, and
// hands back a typed Drizzle handle. makeDb(":memory:") gives tests an isolated
// database; getDb() is the lazily created shared handle the app uses.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Logger } from "drizzle-orm/logger";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isDemoMode } from "@/config/demo-mode";
import * as schema from "./schema";
import { seed } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

const DEFAULT_DB_PATH = ".data/vitals.db";
// Serverless filesystems are read-only except the OS temp dir, and that dir is
// wiped whenever the instance is recycled, which is exactly the "resets on each
// cold start" behaviour demo mode promises.
const DEMO_DB_PATH = join(tmpdir(), "vitals-demo.db");
const MIGRATIONS_FOLDER = resolve(process.cwd(), "drizzle");

export const resolveDbPath = (): string => {
  if (process.env.VITALS_DB_PATH !== undefined) {
    return process.env.VITALS_DB_PATH;
  }
  return isDemoMode() ? DEMO_DB_PATH : DEFAULT_DB_PATH;
};

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

// Importing seed() here is a plain one-way dependency: seed.ts only imports the
// Db type from this file (erased at compile time), and its CLI entry lives in
// scripts/seed-db.ts, so there is no runtime import cycle to reason about.
export const getDb = (): Db => {
  if (sharedDb === null) {
    sharedDb = makeDb();
    if (isDemoMode()) {
      // A fresh instance starts with an empty temp dir, so seed on first open.
      // seed() is idempotent, so a warm instance that re-opens is harmless.
      seed(sharedDb);
    }
  }
  return sharedDb;
};
