// Executes real GraphQL documents against the schema with an in-memory
// database: the cheapest test that proves resolvers, SQL, and types agree.
import { count } from "drizzle-orm";
import { graphql } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "../db";
import { metricEvents, pageviews } from "../db/schema";
import { seed } from "../db/seed";
import type { Context } from "./context";
import { schema } from "./schema";

let db: Db;

const exec = (source: string, variableValues?: Record<string, unknown>) => {
  const contextValue: Context = { db };
  return graphql({ schema, source, contextValue, variableValues });
};

interface PageRow {
  path: string;
  pageviewCount: number;
  eventCount: number;
}

beforeEach(() => {
  db = makeDb(":memory:");
});

describe("Query.sites and Site.pages", () => {
  it("lists every seeded path with counts that add up to the stored rows", async () => {
    seed(db);

    const result = await exec(`{
      sites {
        id
        name
        pages { path pageviewCount eventCount }
      }
    }`);

    expect(result.errors).toBeUndefined();
    const sites = result.data?.sites as Array<{ id: string; name: string; pages: PageRow[] }>;
    const demo = sites.find((site) => site.id === "demo");
    if (!demo) {
      throw new Error("demo site missing from seed");
    }

    const pages = demo.pages;
    const totalPageviews = db.select({ n: count() }).from(pageviews).get()?.n;
    const totalEvents = db.select({ n: count() }).from(metricEvents).get()?.n;

    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages.reduce((sum, page) => sum + page.pageviewCount, 0)).toBe(totalPageviews);
    expect(pages.reduce((sum, page) => sum + page.eventCount, 0)).toBe(totalEvents);
    expect(pages.map((page) => page.path)).toContain("/");
  });

  it("returns pages for one site through the root query, most viewed first", async () => {
    seed(db);

    const result = await exec(`query Pages($siteId: ID!) { pages(siteId: $siteId) { path pageviewCount } }`, {
      siteId: "demo",
    });

    expect(result.errors).toBeUndefined();
    const pages = result.data?.pages as PageRow[];
    const counts = pages.map((page) => page.pageviewCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("Site.sessions limit", () => {
  it("refuses a negative limit, which SQLite would otherwise read as 'no limit' and bypass the cap", async () => {
    seed(db);

    const result = await exec(`{ site(id: "demo") { sessions(limit: -1) { id } } }`);

    expect(result.errors?.[0]?.message).toMatch(/limit/);
    expect(result.data?.site).toBeNull();
  });
});
