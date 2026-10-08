// Per-path traffic aggregates for one site. Lives beside the schema rather than
// inside a resolver so the SQL can be read and tested without GraphQL.
import { count, countDistinct, desc, eq } from "drizzle-orm";
import type { Db } from "../index";
import { metricEvents, pageviews, sessions } from "../schema";

export interface PageAggregate {
  siteId: string;
  path: string;
  pageviewCount: number;
  eventCount: number;
}

export const listPagesForSite = ({ db, siteId }: { db: Db; siteId: string }): PageAggregate[] =>
  db
    .select({
      siteId: sessions.siteId,
      path: pageviews.path,
      // Distinct, because the left join fans each pageview out once per event.
      pageviewCount: countDistinct(pageviews.id),
      eventCount: count(metricEvents.id),
    })
    .from(pageviews)
    .innerJoin(sessions, eq(pageviews.sessionId, sessions.id))
    .leftJoin(metricEvents, eq(metricEvents.pageviewId, pageviews.id))
    .where(eq(sessions.siteId, siteId))
    .groupBy(sessions.siteId, pageviews.path)
    .orderBy(desc(countDistinct(pageviews.id)), pageviews.path)
    .all();
