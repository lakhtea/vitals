import { graphql } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "../db";
import { seed } from "../db/seed";
import type { Context } from "./context";
import { schema } from "./schema";

let db: Db;

function exec(source: string, variableValues?: Record<string, unknown>) {
  const contextValue: Context = { db };
  return graphql({ schema, source, contextValue, variableValues });
}

beforeEach(() => {
  db = makeDb(":memory:");
});

describe("Query.applications", () => {
  it("returns seeded applications, most recently updated first", async () => {
    seed(db);
    const result = await exec(`{ applications { company stage } }`);

    expect(result.errors).toBeUndefined();
    const apps = result.data?.applications as Array<{ company: string; stage: string }>;
    expect(apps).toHaveLength(4);
    expect(apps.map((a) => a.company)).toContain("Netflix");
  });

  it("returns an empty list on a fresh database", async () => {
    const result = await exec(`{ applications { id } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data?.applications).toEqual([]);
  });
});

describe("Mutation.createApplication", () => {
  it("creates and returns an application with defaults applied", async () => {
    const result = await exec(
      `mutation Create($company: String!, $role: String!) {
        createApplication(company: $company, role: $role) {
          id
          company
          role
          stage
        }
      }`,
      { company: "Vercel", role: "DX Engineer" },
    );

    expect(result.errors).toBeUndefined();
    const created = result.data?.createApplication as { company: string; stage: string };
    expect(created.company).toBe("Vercel");
    expect(created.stage).toBe("saved");

    const check = await exec(`{ applications { company } }`);
    expect((check.data?.applications as unknown[]).length).toBe(1);
  });
});
