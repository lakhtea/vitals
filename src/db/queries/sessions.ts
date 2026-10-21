// Session listings and the batched pageview lookup behind Session.pageviews,
// the second DataLoader relation (one statement for any number of sessions).
import { and, asc, desc, eq, exists, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import type { Db } from "../index";
import { pageviews, sessions } from "../schema";
import { sessionDimensionConditions, type TrafficFilter } from "./filter";

export type SessionRow = typeof sessions.$inferSelect;
export type PageviewRow = typeof pageviews.$inferSelect;

/** True for sessions with at least one pageview on the path; EXISTS so a session is never duplicated by its visits. */
const visitedPath = ({ db, path }: { db: Db; path: string }): SQL =>
  exists(
    db
      .select({ one: sql`1` })
      .from(pageviews)
      .where(and(eq(pageviews.sessionId, sessions.id), eq(pageviews.path, path))),
  );

export const listSessionsForSite = ({
  db,
  siteId,
  limit,
  filter,
  path = null,
}: {
  db: Db;
  siteId: string;
  limit: number;
  filter: TrafficFilter;
  /** When set, only sessions that visited this path. */
  path?: string | null;
}): SessionRow[] =>
  db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.siteId, siteId),
        path === null ? undefined : visitedPath({ db, path }),
        ...sessionDimensionConditions(filter),
        filter.from === null ? undefined : gte(sessions.startedAt, filter.from),
        filter.to === null ? undefined : lt(sessions.startedAt, filter.to),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .all();

/** Returns one array per requested session id, in the same order, each in visit order. */
export const listPageviewsBySession = ({
  db,
  sessionIds,
}: {
  db: Db;
  sessionIds: readonly string[];
}): PageviewRow[][] => {
  if (sessionIds.length === 0) {
    return [];
  }
  const rows = db
    .select()
    .from(pageviews)
    .where(inArray(pageviews.sessionId, [...sessionIds]))
    .orderBy(asc(pageviews.startedAt))
    .all();

  const bySession = rows.reduce((groups, row) => {
    groups.set(row.sessionId, [...(groups.get(row.sessionId) ?? []), row]);
    return groups;
  }, new Map<string, PageviewRow[]>());

  return sessionIds.map((sessionId) => bySession.get(sessionId) ?? []);
};
