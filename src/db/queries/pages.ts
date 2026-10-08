// Per-path traffic aggregates for one site. Lives beside the schema rather than
// inside a resolver so the SQL can be read and tested without GraphQL.
import { and, count, countDistinct, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../index";
import { metricEvents, pageviews, sessions } from "../schema";
import { sessionDimensionConditions, type TrafficFilter } from "./filter";

export interface PageAggregate {
  siteId: string;
  path: string;
  pageviewCount: number;
  eventCount: number;
}

export const listPagesForSite = ({
  db,
  siteId,
  filter,
}: {
  db: Db;
  siteId: string;
  filter: TrafficFilter;
}): PageAggregate[] =>
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
    .where(
      and(
        eq(sessions.siteId, siteId),
        ...sessionDimensionConditions(filter),
        filter.from === null ? undefined : gte(pageviews.startedAt, filter.from),
        filter.to === null ? undefined : lt(pageviews.startedAt, filter.to),
      ),
    )
    .groupBy(sessions.siteId, pageviews.path)
    .orderBy(desc(countDistinct(pageviews.id)), pageviews.path)
    .all();
