// The proposed-fix lifecycle (M14) through real GraphQL documents: an agent
// submits a revision, a person edits it into a new one, and approving pins the
// latest. Run against an in-memory database, the way the dashboard and the MCP server call it.
import { graphql } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import {
  fixRevisions,
  type IncidentInsert,
  incidents,
  incidentSteps,
  sites,
} from "@/db/schema";
import { type Context } from "./context";
import { schema } from "./schema";

const SITE_ID = "t";
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const BEFORE = "export const TIMEOUT_MS = 5_000;\nexport const RETRIES = 2;\n";
const AFTER = "export const TIMEOUT_MS = 5_000;\nexport const RETRIES = 3;\n";

let db: Db;

const exec = async ({
  source,
  variableValues,
  isService = false,
}: {
  source: string;
  variableValues?: Record<string, unknown>;
  isService?: boolean;
}) => {
  const contextValue: Context = { db, isService };
  return graphql({ schema, source, contextValue, variableValues });
};

const insertIncident = (overrides: Partial<IncidentInsert> = {}): number => {
  const row: IncidentInsert = {
    siteId: SITE_ID,
    source: "health-check",
    subject: "api-latency-p95",
    metric: null,
    status: "open",
    detectedAt: T0,
    updatedAt: T0,
    evidence: {
      kind: "health-check",
      checkId: "api-latency-p95",
      name: "API latency p95",
      status: "failing",
      previousStatus: "ok",
      consecutive: 3,
      value: 900,
      unit: "ms",
      observedAt: T0,
      detail: null,
    },
    ...overrides,
  };
  return db.insert(incidents).values(row).returning().get().id;
};

const SUBMIT = `
  mutation Submit($incidentId: ID!, $files: [FixFileInput!]!) {
    submitFixRevision(incidentId: $incidentId, targetRepo: "lakhtea/vitals", baseSha: "abc123", summary: "Retry once more", files: $files) {
      id number author
    }
  }
`;

const EDIT = `
  mutation Edit($revisionId: ID!, $files: [FixFileEdit!]!, $note: String) {
    editFixRevision(revisionId: $revisionId, files: $files, note: $note) {
      id number author files { path action afterContent } diff
    }
  }
`;

const APPROVE = `
  mutation Approve($id: ID!, $revisionId: ID) {
    approveIncident(id: $id, revisionId: $revisionId) { status approvedRevision { number author } }
  }
`;

const REVIEWED = `query Reviewed($id: ID!) { incident(id: $id) { latestFixRevision { number reviewed } fixRevisions { number } } }`;

const twoFiles = [
  {
    path: "src/retry.ts",
    action: "MODIFY",
    beforeContent: BEFORE,
    afterContent: AFTER,
  },
  { path: "docs/retry.md", action: "ADD", afterContent: "# Retries\n" },
  { path: "src/legacy.ts", action: "DELETE", beforeContent: "export {};\n" },
];

/** Submits the three-file revision as the agent and returns its id. */
const submit = async (incidentId: number): Promise<string> => {
  const result = await exec({
    source: SUBMIT,
    variableValues: { incidentId: String(incidentId), files: twoFiles },
    isService: true,
  });
  expect(result.errors).toBeUndefined();
  return (result.data?.submitFixRevision as { id: string }).id;
};

beforeEach(() => {
  db = makeDb(":memory:");
  db.insert(sites).values({ id: SITE_ID, name: "T", createdAt: T0 }).run();
});

describe("submitFixRevision", () => {
  it("needs the service token and writes nothing without it", async () => {
    const incidentId = insertIncident();
    const result = await exec({
      source: SUBMIT,
      variableValues: { incidentId: String(incidentId), files: twoFiles },
    });
    expect(result.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
    expect(db.select().from(fixRevisions).all()).toEqual([]);
  });

  it("writes revision 1 authored by the agent", async () => {
    const incidentId = insertIncident();
    await submit(incidentId);
    expect(db.select().from(fixRevisions).all()).toMatchObject([
      { incidentId, number: 1, author: "agent" },
    ]);
  });

  it.each([
    [
      "a dismissed incident",
      { status: "dismissed" as const },
      twoFiles,
      /"dismissed"; a fix can only be proposed while it is live/,
    ],
    [
      "an approved incident",
      { status: "approved" as const },
      twoFiles,
      /"approved"/,
    ],
    [
      "a path that climbs out of the repo",
      {},
      [{ path: "../etc/passwd", action: "ADD", afterContent: "x" }],
      /"\.\."/,
    ],
    [
      "an absolute path",
      {},
      [{ path: "/etc/passwd", action: "ADD", afterContent: "x" }],
      /relative/,
    ],
    ["a repeated path", {}, [twoFiles[1], twoFiles[1]], /more than once/],
    [
      "an add with before content",
      {},
      [{ ...twoFiles[1], beforeContent: "x" }],
      /added file/,
    ],
    [
      "a delete with after content",
      {},
      [{ ...twoFiles[2], afterContent: "x" }],
      /deleted file/,
    ],
    [
      "a modify that changes nothing",
      {},
      [{ ...twoFiles[0], afterContent: BEFORE }],
      /must change something/,
    ],
    ["no files", {}, [], /1 to 20 files/],
    [
      "too many files",
      {},
      Array.from({ length: 21 }, (_, i) => ({
        path: `f${i}.md`,
        action: "ADD",
        afterContent: "x",
      })),
      /1 to 20 files/,
    ],
    [
      "an oversized file",
      {},
      [{ path: "big.txt", action: "ADD", afterContent: "é".repeat(100_001) }],
      /200000 UTF-8 bytes/,
    ],
  ])(
    "refuses %s and writes nothing",
    async (_name, overrides, files, message) => {
      const incidentId = insertIncident(overrides);
      const result = await exec({
        source: SUBMIT,
        variableValues: { incidentId: String(incidentId), files },
        isService: true,
      });
      expect(result.errors?.[0]?.message).toMatch(message);
      expect(db.select().from(fixRevisions).all()).toEqual([]);
    },
  );
});

describe("editFixRevision", () => {
  it("writes revision 2 by a human, copies untouched files, records the HUMAN step, and diffs the edit", async () => {
    const incidentId = insertIncident();
    const revisionId = await submit(incidentId);
    const edited = AFTER.replace("5_000", "10_000");

    const result = await exec({
      source: EDIT,
      variableValues: {
        revisionId,
        files: [{ path: "src/retry.ts", afterContent: edited }],
        note: "  give it longer  ",
      },
    });

    expect(result.errors).toBeUndefined();
    const revision = result.data?.editFixRevision as {
      number: number;
      author: string;
      files: { path: string; action: string; afterContent: string | null }[];
      diff: string;
    };
    expect(revision).toMatchObject({ number: 2, author: "HUMAN" });
    expect(revision.files).toEqual([
      { path: "src/retry.ts", action: "MODIFY", afterContent: edited },
      { path: "docs/retry.md", action: "ADD", afterContent: "# Retries\n" },
      { path: "src/legacy.ts", action: "DELETE", afterContent: null },
    ]);
    expect(revision.diff).toContain("+export const TIMEOUT_MS = 10_000;");
    expect(revision.diff).toContain("-export const TIMEOUT_MS = 5_000;");
    expect(db.select().from(incidentSteps).all()).toMatchObject([
      {
        incidentId,
        role: "human",
        status: "succeeded",
        summary: "Edited the proposed change (revision 2)",
        detail: "give it longer",
      },
    ]);
  });

  it.each([
    [
      "a stale revision",
      "stale",
      /Revision 1 is not the latest; edit revision 2/,
    ],
    [
      "an edit to a DELETE file",
      "delete",
      /only added and modified files can be edited/,
    ],
    ["an edit that changes nothing", "noop", /Nothing changed/],
  ] as const)("refuses %s and writes nothing", async (_name, kind, message) => {
    const incidentId = insertIncident();
    const revisionId = await submit(incidentId);
    if (kind === "stale") {
      await exec({
        source: EDIT,
        variableValues: {
          revisionId,
          files: [{ path: "docs/retry.md", afterContent: "# R\n" }],
        },
      });
    }
    const files =
      kind === "delete"
        ? [{ path: "src/legacy.ts", afterContent: "x" }]
        : kind === "noop"
          ? [{ path: "src/retry.ts", afterContent: AFTER }]
          : [{ path: "src/retry.ts", afterContent: "y" }];
    const revisionsBefore = db.select().from(fixRevisions).all().length;

    const result = await exec({
      source: EDIT,
      variableValues: { revisionId, files },
    });

    expect(result.errors?.[0]?.message).toMatch(message);
    expect(db.select().from(fixRevisions).all()).toHaveLength(revisionsBefore);
  });
});

describe("approveIncident pins the latest revision", () => {
  it("refuses an approval without revisionId once a fix exists, naming the latest number", async () => {
    const incidentId = insertIncident();
    await submit(incidentId);
    const result = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId) },
    });
    expect(result.errors?.[0]?.message).toMatch(
      /revisionId for revision 1, the latest/,
    );
    expect(db.select().from(incidents).get()?.status).toBe("open");
  });

  it("refuses a stale revision and one from another incident, naming both numbers", async () => {
    const incidentId = insertIncident();
    const first = await submit(incidentId);
    await exec({
      source: EDIT,
      variableValues: {
        revisionId: first,
        files: [{ path: "docs/retry.md", afterContent: "# R\n" }],
      },
    });
    const otherIncident = insertIncident({ subject: "other-check" });
    const foreign = await submit(otherIncident);

    const stale = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId), revisionId: first },
    });
    const fromElsewhere = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId), revisionId: foreign },
    });

    expect(stale.errors?.[0]?.message).toMatch(
      /Revision 1 is not the latest; review revision 2/,
    );
    expect(fromElsewhere.errors?.[0]?.message).toMatch(
      /Revision 1 belongs to another incident; .* latest revision is 2/,
    );
    expect(
      db
        .select()
        .from(incidents)
        .all()
        .map((row) => row.status),
    ).toEqual(["open", "open"]);
  });

  it("pins the latest revision, which approvedRevision then returns", async () => {
    const incidentId = insertIncident();
    const first = await submit(incidentId);
    const edit = await exec({
      source: EDIT,
      variableValues: {
        revisionId: first,
        files: [{ path: "docs/retry.md", afterContent: "# R\n" }],
      },
    });
    const latest = (edit.data?.editFixRevision as { id: string }).id;

    const result = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId), revisionId: latest },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.approveIncident).toEqual({
      status: "APPROVED",
      approvedRevision: { number: 2, author: "HUMAN" },
    });
    const afterApproval = await exec({
      source: EDIT,
      variableValues: {
        revisionId: latest,
        files: [{ path: "docs/retry.md", afterContent: "# S\n" }],
      },
    });
    expect(afterApproval.errors?.[0]?.message).toMatch(
      /"approved"; its proposed fix can no longer be edited/,
    );
  });

  it("refuses a revisionId when the incident has no fix, and approves without one", async () => {
    const incidentId = insertIncident();
    const refused = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId), revisionId: "1" },
    });
    const approved = await exec({
      source: APPROVE,
      variableValues: { id: String(incidentId) },
    });
    expect(refused.errors?.[0]?.message).toMatch(/no proposed fix/);
    expect(approved.data?.approveIncident).toEqual({
      status: "APPROVED",
      approvedRevision: null,
    });
  });
});

describe("reviewed", () => {
  it("is true only once a SUCCEEDED REVIEW step started at or after the revision was written", async () => {
    const incidentId = insertIncident();
    await submit(incidentId);
    const createdAt = db.select().from(fixRevisions).get()?.createdAt ?? 0;
    const step = (overrides: Partial<typeof incidentSteps.$inferInsert>) =>
      db
        .insert(incidentSteps)
        .values({
          incidentId,
          role: "review",
          status: "succeeded",
          startedAt: createdAt,
          summary: "Reviewed",
          ...overrides,
        })
        .run();
    const reviewed = async () =>
      (
        (
          await exec({
            source: REVIEWED,
            variableValues: { id: String(incidentId) },
          })
        ).data?.incident as {
          latestFixRevision: { reviewed: boolean };
        }
      ).latestFixRevision.reviewed;

    step({ startedAt: createdAt - HOUR });
    step({ status: "failed" });
    step({ role: "summarize" });
    expect(await reviewed()).toBe(false);

    step({});
    expect(await reviewed()).toBe(true);
  });
});
