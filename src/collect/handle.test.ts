// Drives the collect endpoint the way a browser does: real Request objects in,
// real Response objects out, rows checked in an in-memory database. This is
// the trust boundary of the whole system, so the suite leans on rejections.
import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { UNFILTERED } from "@/db/queries/filter";
import { listPagesForSite } from "@/db/queries/pages";
import { metricEvents, pageviews, sessions, sites } from "@/db/schema";
import { rateMetric } from "@/vitals/metrics";
import { MAX_EVENTS_PER_BATCH } from "./payload";
import { corsPreflightResponse, handleCollect } from "./handle";

const SITE_ID = "demo";
const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);

let db: Db;

const countRows = () => ({
  sessions: db.select({ n: count() }).from(sessions).get()?.n,
  pageviews: db.select({ n: count() }).from(pageviews).get()?.n,
  events: db.select({ n: count() }).from(metricEvents).get()?.n,
});

const validBatch = () => ({
  siteId: SITE_ID,
  session: {
    id: "s-1",
    startedAt: NOW,
    deviceClass: "mobile",
    connectionType: "4g",
    userAgentFamily: "Chrome",
  },
  pageview: { id: "pv-1", path: "/pricing", startedAt: NOW },
  events: [
    { id: "v4-1", name: "LCP", value: 2612.4, recordedAt: NOW + 2612 },
    { id: "v4-2", name: "CLS", value: 0.03, recordedAt: NOW + 9000 },
    { id: "v4-3", name: "INP", value: 184, recordedAt: NOW + 15000 },
  ],
});

const post = (body: unknown) =>
  handleCollect({
    db,
    now: NOW + 60_000,
    request: new Request("http://localhost/api/collect", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

beforeEach(() => {
  db = makeDb(":memory:");
  db.insert(sites).values({ id: SITE_ID, name: "Demo", createdAt: NOW }).run();
});

describe("POST /api/collect", () => {
  it("stores a batch with server-computed ratings and reuses the session for a later pageview", async () => {
    const first = await post(validBatch());

    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ inserted: 3, duplicates: 0 });

    const stored = db.select().from(metricEvents).all();
    expect(stored.map((event) => event.rating)).toEqual(stored.map((event) => rateMetric(event)));
    expect(listPagesForSite({ db, siteId: SITE_ID, filter: UNFILTERED })).toEqual([
      { siteId: SITE_ID, path: "/pricing", pageviewCount: 1, eventCount: 3 },
    ]);

    const secondPageview = {
      ...validBatch(),
      pageview: { id: "pv-2", path: "/docs", startedAt: NOW + 30_000 },
      events: [{ id: "v4-9", name: "TTFB", value: 410, recordedAt: NOW + 30_410 }],
    };
    expect((await post(secondPageview)).status).toBe(202);
    expect(countRows()).toEqual({ sessions: 1, pageviews: 2, events: 4 });
  });

  it("stores a batch delivered twice exactly once", async () => {
    await post(validBatch());
    const retry = await post(validBatch());

    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual({ inserted: 0, duplicates: 3 });
    expect(countRows()).toEqual({ sessions: 1, pageviews: 1, events: 3 });
  });

  it.each([
    ["malformed JSON", "{not json", 400, "invalid_json", undefined],
    [
      "an unknown metric name",
      { ...validBatch(), events: [{ id: "x", name: "FID", value: 50, recordedAt: NOW }] },
      422,
      "invalid_payload",
      "events.0.name",
    ],
    [
      "an implausible metric value",
      { ...validBatch(), events: [{ id: "x", name: "LCP", value: -5, recordedAt: NOW }] },
      422,
      "invalid_payload",
      "events.0.value",
    ],
    [
      "a timestamp from the future",
      { ...validBatch(), pageview: { id: "pv-1", path: "/", startedAt: NOW + 24 * 60 * 60 * 1000 } },
      422,
      "invalid_payload",
      "pageview.startedAt",
    ],
    [
      "more events than the batch cap",
      {
        ...validBatch(),
        events: Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, (_, i) => ({
          id: `v4-${i}`,
          name: "CLS",
          value: 0.01,
          recordedAt: NOW,
        })),
      },
      413,
      "batch_too_large",
      undefined,
    ],
    [
      "a path carrying a query string",
      { ...validBatch(), pageview: { id: "pv-1", path: "/pricing?token=abc", startedAt: NOW } },
      422,
      "invalid_payload",
      "pageview.path",
    ],
    ["an unknown site", { ...validBatch(), siteId: "nope" }, 404, "unknown_site", undefined],
  ])("rejects %s without storing anything", async (_label, body, status, code, issuePath) => {
    const response = await post(body);

    expect(response.status).toBe(status);
    const payload = (await response.json()) as {
      error: { code: string; issues?: Array<{ path: string; message: string }> };
    };
    expect(payload.error.code).toBe(code);
    if (issuePath !== undefined) {
      expect(payload.error.issues?.map((issue) => issue.path)).toContain(issuePath);
    }
    expect(countRows()).toEqual({ sessions: 0, pageviews: 0, events: 0 });
  });

  it("answers cross-origin preflights and tags every response for CORS", async () => {
    const preflight = corsPreflightResponse();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");

    const accepted = await post(validBatch());
    expect(accepted.headers.get("access-control-allow-origin")).toBe("*");
  });
});
