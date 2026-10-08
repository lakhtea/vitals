// Persists one validated batch. Session and pageview inserts ignore conflicts
// (a retry or a later pageview of the same session is normal), and the unique
// (pageview, name, metric id) index turns duplicate events into no-ops.
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { metricEvents, pageviews, sessions, sites } from "@/db/schema";
import { rateMetric } from "@/vitals/metrics";
import type { CollectPayload } from "./payload";

export interface IngestResult {
  inserted: number;
  duplicates: number;
}

export const siteExists = ({ db, siteId }: { db: Db; siteId: string }): boolean =>
  db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get() !== undefined;

export const ingestBatch = ({ db, payload }: { db: Db; payload: CollectPayload }): IngestResult =>
  db.transaction((tx) => {
    tx.insert(sessions)
      .values({ ...payload.session, siteId: payload.siteId })
      .onConflictDoNothing()
      .run();

    tx.insert(pageviews)
      .values({ ...payload.pageview, sessionId: payload.session.id })
      .onConflictDoNothing()
      .run();

    const { changes: inserted } = tx
      .insert(metricEvents)
      .values(
        payload.events.map((event) => ({
          pageviewId: payload.pageview.id,
          metricId: event.id,
          name: event.name,
          value: event.value,
          rating: rateMetric(event),
          recordedAt: event.recordedAt,
        })),
      )
      .onConflictDoNothing()
      .run();

    return { inserted, duplicates: payload.events.length - inserted };
  });
