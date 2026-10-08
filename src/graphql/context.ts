// What every resolver receives as its third argument. Passing the database in,
// rather than importing it, is what lets tests run the schema on :memory:.
import { getDb, type Db } from "@/db";

export interface Context {
  db: Db;
}

/** Yoga calls this once per request. */
export const createContext = (): Context => ({ db: getDb() });
