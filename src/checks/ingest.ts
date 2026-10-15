// Persists one validated batch of check observations. The unique
// (site, check id, observed_at) index turns a retried delivery into a no-op,
// so the response can say exactly how many rows were new. The site lookup
// lives here too: it is the one other statement the endpoint runs.
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { checks, sites } from "@/db/schema";
import type { ChecksPayload } from "./payload";

export interface ChecksIngestResult {
  inserted: number;
  duplicates: number;
}

export interface SiteCredential {
  id: string;
  /** Null when the site accepts no checks at all. */
  writeKey: string | null;
}

export const findSiteCredential = ({ db, siteId }: { db: Db; siteId: string }): SiteCredential | undefined =>
  db.select({ id: sites.id, writeKey: sites.writeKey }).from(sites).where(eq(sites.id, siteId)).get();

export const ingestChecks = ({ db, payload }: { db: Db; payload: ChecksPayload }): ChecksIngestResult => {
  const { changes: inserted } = db
    .insert(checks)
    .values(
      payload.checks.map((check) => ({
        siteId: payload.siteId,
        checkId: check.id,
        name: check.name,
        status: check.status,
        value: check.value ?? null,
        unit: check.unit ?? null,
        observedAt: check.observedAt,
        detail: check.detail ?? null,
      })),
    )
    .onConflictDoNothing()
    .run();

  return { inserted, duplicates: payload.checks.length - inserted };
};
