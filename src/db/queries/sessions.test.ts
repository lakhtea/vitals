// Page.sessions asks, per candidate session, whether it visited the path. On
// the stress seed that probe went from 14 ms to 0.15 ms once the pageviews
// index covered (session_id, path) instead of session_id alone; this pins the
// plan so the index cannot quietly stop being used.
import { sql } from "drizzle-orm";
import type { Logger } from "drizzle-orm/logger";
import { describe, expect, it } from "vitest";
import { makeDb } from "../index";
import { listSessionsForSite } from "./sessions";

/** The statement with its bound values written in as literals, which EXPLAIN QUERY PLAN needs to see as one text. */
const inlineParams = ({ sqlText, params }: { sqlText: string; params: readonly unknown[] }): string =>
  params.reduce<string>((text, param) => {
    const literal = typeof param === "string" ? `'${param.replace(/'/g, "''")}'` : String(param);
    return text.replace("?", literal);
  }, sqlText);

describe("listSessionsForSite with a path", () => {
  it("answers the visited-path probe from the (session_id, path) index, not by scanning the path's pageviews", () => {
    let statement: { sqlText: string; params: unknown[] } | null = null;
    const logger: Logger = {
      logQuery: (sqlText, params) => {
        statement = { sqlText, params };
      },
    };
    const db = makeDb(":memory:", { logger });

    listSessionsForSite({
      db,
      siteId: "demo",
      limit: 50,
      filter: { from: null, to: null, deviceClass: null, connectionType: null },
      path: "/pricing",
    });

    if (statement === null) {
      throw new Error("listSessionsForSite executed no statement");
    }
    const plan = db.all<{ detail: string }>(sql.raw(`EXPLAIN QUERY PLAN ${inlineParams(statement)}`));
    const pageviewsStep = plan.find((row) => row.detail.includes("pageviews"));

    expect(pageviewsStep?.detail).toContain("pageviews_session_path_idx (session_id=? AND path=?)");
  });
});
