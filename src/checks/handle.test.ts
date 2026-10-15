// Drives the checks endpoint the way an application does: real Request objects
// in, real Response objects out, rows checked in an in-memory database. The
// write key is the one credential in the system, so the suite leans on refusals.
import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { checks, sites } from "@/db/schema";
import { handleChecks } from "./handle";
import { MAX_CHECKS_PER_BATCH } from "./payload";

const SITE_ID = "demo";
const KEYLESS_SITE_ID = "keyless";
const WRITE_KEY = "wk_test_0123456789";
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

let db: Db;

const countRows = (): number | undefined => db.select({ n: count() }).from(checks).get()?.n;

const validBatch = () => ({
  siteId: SITE_ID,
  checks: [
    {
      id: "api-health",
      name: "API health",
      status: "failing",
      value: null,
      unit: null,
      observedAt: NOW,
      detail: "HTTP 503 from /healthz",
    },
    { id: "db-latency-p95", name: "DB latency p95", status: "ok", value: 41.5, unit: "ms", observedAt: NOW },
  ],
});

const post = (body: unknown, { authorization = `Bearer ${WRITE_KEY}` }: { authorization?: string | null } = {}) =>
  handleChecks({
    db,
    now: NOW + 60_000,
    request: new Request("http://localhost/api/checks", {
      method: "POST",
      headers: authorization === null ? {} : { authorization },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

beforeEach(() => {
  db = makeDb(":memory:");
  db.insert(sites)
    .values([
      { id: SITE_ID, name: "Demo", createdAt: NOW, writeKey: WRITE_KEY },
      { id: KEYLESS_SITE_ID, name: "Keyless", createdAt: NOW, writeKey: null },
    ])
    .run();
});

describe("POST /api/checks", () => {
  it("stores a batch for the site that presented its write key and reports the counts", async () => {
    const response = await post(validBatch());

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ inserted: 2, duplicates: 0 });
    expect(db.select().from(checks).all()).toMatchObject([
      { siteId: SITE_ID, checkId: "api-health", status: "failing", value: null, unit: null, detail: "HTTP 503 from /healthz" },
      { siteId: SITE_ID, checkId: "db-latency-p95", status: "ok", value: 41.5, unit: "ms", detail: null },
    ]);
  });

  it("stores a batch delivered twice exactly once", async () => {
    await post(validBatch());
    const retry = await post(validBatch());

    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual({ inserted: 0, duplicates: 2 });
    expect(countRows()).toBe(2);
  });

  it.each([
    ["malformed JSON", "{not json", undefined, 400, "invalid_json", undefined],
    [
      "an unknown status",
      { ...validBatch(), checks: [{ id: "x", name: "X", status: "broken", observedAt: NOW }] },
      undefined,
      422,
      "invalid_payload",
      "checks.0.status",
    ],
    [
      "an observation from the future",
      { ...validBatch(), checks: [{ id: "x", name: "X", status: "ok", observedAt: NOW + 24 * 60 * 60 * 1000 }] },
      undefined,
      422,
      "invalid_payload",
      "checks.0.observedAt",
    ],
    [
      "more checks than the batch cap",
      {
        ...validBatch(),
        checks: Array.from({ length: MAX_CHECKS_PER_BATCH + 1 }, (_, i) => ({
          id: `check-${i}`,
          name: `Check ${i}`,
          status: "ok",
          observedAt: NOW,
        })),
      },
      undefined,
      413,
      "batch_too_large",
      undefined,
    ],
    ["a missing write key", validBatch(), null, 401, "invalid_write_key", undefined],
    ["a wrong write key", validBatch(), "Bearer wk_wrong", 401, "invalid_write_key", undefined],
    ["a key presented without the Bearer scheme", validBatch(), WRITE_KEY, 401, "invalid_write_key", undefined],
    [
      "a site that accepts no checks",
      { ...validBatch(), siteId: KEYLESS_SITE_ID },
      `Bearer ${WRITE_KEY}`,
      401,
      "invalid_write_key",
      undefined,
    ],
    ["an unknown site", { ...validBatch(), siteId: "nope" }, undefined, 404, "unknown_site", undefined],
  ])("rejects %s without storing anything", async (_label, body, authorization, status, code, issuePath) => {
    const response = await post(body, authorization === undefined ? {} : { authorization });

    expect(response.status).toBe(status);
    const payload = (await response.json()) as {
      error: { code: string; issues?: Array<{ path: string; message: string }> };
    };
    expect(payload.error.code).toBe(code);
    if (issuePath !== undefined) {
      expect(payload.error.issues?.map((issue) => issue.path)).toContain(issuePath);
    }
    expect(countRows()).toBe(0);
  });

  it("sends no CORS headers: this is a server-to-server endpoint", async () => {
    const response = await post(validBatch());

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
