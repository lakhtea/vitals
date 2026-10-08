// Session listings and the batched pageview lookup behind Session.pageviews,
// the second DataLoader relation (one statement for any number of sessions).
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Db } from "../index";
import { pageviews, sessions } from "../schema";
import { sessionDimensionConditions, type TrafficFilter } from "./filter";

export type SessionRow = typeof sessions.$inferSelect;
export type PageviewRow = typeof pageviews.$inferSelect;

export const listSessionsForSite = ({
  db,
  siteId,
  limit,
  filter,
}: {
  db: Db;
  siteId: string;
  limit: number;
  filter: TrafficFilter;
}): SessionRow[] =>
  db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.siteId, siteId),
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
