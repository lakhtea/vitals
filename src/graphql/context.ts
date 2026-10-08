import { db as defaultDb, type Db } from "../db";

export interface Context {
  db: Db;
}

/** Yoga calls this per request; tests can build a Context around makeDb(":memory:"). */
export function createContext(): Context {
  return { db: defaultDb };
}
