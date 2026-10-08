// Counts the SQL statements a Drizzle handle executes, so a test can pin the
// query cost of one GraphQL operation. This is the instrument behind every
// before/after number in the README's metrics table.
import type { Logger } from "drizzle-orm/logger";

export interface QueryCounter {
  logger: Logger;
  count: () => number;
  queries: () => readonly string[];
  reset: () => void;
}

export const createQueryCounter = (): QueryCounter => {
  let executed: string[] = [];
  return {
    logger: {
      logQuery: (query) => {
        executed = [...executed, query];
      },
    },
    count: () => executed.length,
    queries: () => executed,
    reset: () => {
      executed = [];
    },
  };
};
