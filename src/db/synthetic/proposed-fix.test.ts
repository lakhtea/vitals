// Keeps the seeded proposed fix honest: its `before` is the file on disk, so
// editing src/demo/slow-upstream.ts without updating the fixture fails here;
// and attaching it is idempotent across the seed, detect, attach sequence.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeDb } from "@/db";
import { fixRevisionFiles, fixRevisions } from "@/db/schema";
import { attachSeededFix, DEMO_SITE, seed } from "@/db/seed";
import { detectIncidents } from "@/incidents/detect";
import { validateRevisionFiles } from "@/incidents/fix";
import { SEEDED_FIX, SEEDED_FIX_FILES } from "./proposed-fix";

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

describe("SEEDED_FIX", () => {
  it("starts from src/demo/slow-upstream.ts exactly as committed", () => {
    expect(SEEDED_FIX.before).toBe(readFileSync(resolve(process.cwd(), SEEDED_FIX.path), "utf8"));
  });

  it("carries the 5_000 ms timeout the e2e edits, and is a valid revision", () => {
    expect(SEEDED_FIX.after).toContain("5_000");
    expect(validateRevisionFiles(SEEDED_FIX_FILES)).toEqual({ ok: true });
  });
});

describe("attachSeededFix", () => {
  it("does nothing before detection, then attaches revision 1 once, however often it runs", () => {
    const db = makeDb(":memory:");
    seed(db, NOW);
    expect(attachSeededFix({ db, now: NOW })).toBe(false);

    detectIncidents({ db, siteId: DEMO_SITE.id, now: NOW });
    expect(attachSeededFix({ db, now: NOW })).toBe(true);
    seed(db, NOW);
    detectIncidents({ db, siteId: DEMO_SITE.id, now: NOW });
    expect(attachSeededFix({ db, now: NOW })).toBe(false);

    expect(db.select().from(fixRevisions).all()).toMatchObject([{ number: 1, author: "agent", baseSha: "seeded-demo" }]);
    expect(db.select().from(fixRevisionFiles).all()).toMatchObject([
      { path: "src/demo/slow-upstream.ts", action: "modify", afterContent: SEEDED_FIX.after },
    ]);
  });
});
