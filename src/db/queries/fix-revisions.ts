// Fix revisions: the reads behind the review panel and the two writes that
// create one, an agent's submit and a person's edit. Revisions are immutable;
// an edit writes the next number. Each write runs in one transaction so the
// "is this the latest revision of a live incident" check and the insert cannot interleave.
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { type RevisionFile, validateRevisionFiles } from "@/incidents/fix";
import { type IncidentStatus, isTerminalIncidentStatus } from "@/incidents/vocabulary";
import type { Db } from "../index";
import {
  fixRevisionFiles,
  fixRevisions,
  type FixRevisionFileRow,
  type FixRevisionRow,
  incidents,
  incidentSteps,
} from "../schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Oldest first: the history reads top to bottom. */
export const listFixRevisionsForIncident = ({ db, incidentId }: { db: Db; incidentId: number }): FixRevisionRow[] =>
  db.select().from(fixRevisions).where(eq(fixRevisions.incidentId, incidentId)).orderBy(asc(fixRevisions.number)).all();

export const getFixRevision = ({ db, id }: { db: Db | Tx; id: number }): FixRevisionRow | undefined =>
  db.select().from(fixRevisions).where(eq(fixRevisions.id, id)).get();

export const getLatestFixRevision = ({ db, incidentId }: { db: Db | Tx; incidentId: number }): FixRevisionRow | undefined =>
  db
    .select()
    .from(fixRevisions)
    .where(eq(fixRevisions.incidentId, incidentId))
    .orderBy(desc(fixRevisions.number))
    .limit(1)
    .get();

/** In the order they were submitted, which is the order the diff prints them. */
export const listFilesForRevision = ({ db, revisionId }: { db: Db | Tx; revisionId: number }): FixRevisionFileRow[] =>
  db.select().from(fixRevisionFiles).where(eq(fixRevisionFiles.revisionId, revisionId)).orderBy(asc(fixRevisionFiles.id)).all();

/**
 * True when a REVIEW step that SUCCEEDED started at or after the revision was
 * written: the reviewer looked at this version, not an older one. One EXISTS
 * statement per revision asked about.
 */
export const isRevisionReviewed = ({ db, revision }: { db: Db; revision: FixRevisionRow }): boolean =>
  db
    .select({ one: sql<number>`1` })
    .from(incidentSteps)
    .where(
      and(
        eq(incidentSteps.incidentId, revision.incidentId),
        eq(incidentSteps.role, "review"),
        eq(incidentSteps.status, "succeeded"),
        gte(incidentSteps.startedAt, revision.createdAt),
      ),
    )
    .limit(1)
    .get() !== undefined;

export const toRevisionFile = (row: FixRevisionFileRow): RevisionFile => ({
  path: row.path,
  action: row.action,
  before: row.beforeContent,
  after: row.afterContent,
});

/** A fix can be proposed or edited only while nobody has decided and nothing has closed the incident. */
const isLiveForFixes = (status: IncidentStatus): boolean => status !== "approved" && !isTerminalIncidentStatus(status);

const insertRevision = ({
  tx,
  incidentId,
  number,
  author,
  targetRepo,
  baseSha,
  summary,
  files,
  now,
}: {
  tx: Tx;
  incidentId: number;
  number: number;
  author: FixRevisionRow["author"];
  targetRepo: string;
  baseSha: string;
  summary: string;
  files: readonly RevisionFile[];
  now: number;
}): FixRevisionRow => {
  const revision = tx
    .insert(fixRevisions)
    .values({ incidentId, number, author, createdAt: now, targetRepo, baseSha, summary })
    .returning()
    .get();
  tx.insert(fixRevisionFiles)
    .values(
      files.map((file) => ({
        revisionId: revision.id,
        path: file.path,
        action: file.action,
        beforeContent: file.before,
        afterContent: file.after,
      })),
    )
    .run();
  tx.update(incidents).set({ updatedAt: now }).where(eq(incidents.id, incidentId)).run();
  return revision;
};

export interface SubmitFixInput {
  incidentId: number;
  targetRepo: string;
  baseSha: string;
  summary: string;
  files: RevisionFile[];
}

export type SubmitFixResult =
  | { ok: true; revision: FixRevisionRow }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-live"; status: IncidentStatus };

/** An agent proposes a change: the next revision, authored by the agent. */
export const submitFixRevision = ({ db, input, now }: { db: Db; input: SubmitFixInput; now: number }): SubmitFixResult => {
  const targetRepo = input.targetRepo.trim();
  const baseSha = input.baseSha.trim();
  const summary = input.summary.trim();
  if (targetRepo === "" || baseSha === "" || summary === "") {
    return { ok: false, reason: "invalid", message: "targetRepo, baseSha, and summary must not be blank" };
  }
  const check = validateRevisionFiles(input.files);
  if (!check.ok) {
    return { ok: false, reason: "invalid", message: check.message };
  }

  return db.transaction((tx): SubmitFixResult => {
    const incident = tx.select({ status: incidents.status }).from(incidents).where(eq(incidents.id, input.incidentId)).get();
    if (incident === undefined) {
      return { ok: false, reason: "not-found" };
    }
    if (!isLiveForFixes(incident.status)) {
      return { ok: false, reason: "not-live", status: incident.status };
    }
    const latest = getLatestFixRevision({ db: tx, incidentId: input.incidentId });
    const revision = insertRevision({
      tx,
      incidentId: input.incidentId,
      number: (latest?.number ?? 0) + 1,
      author: "agent",
      targetRepo,
      baseSha,
      summary,
      files: input.files,
      now,
    });
    return { ok: true, revision };
  });
};

export interface FileEdit {
  path: string;
  after: string;
}

export type EditFixResult =
  | { ok: true; revision: FixRevisionRow }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-live"; status: IncidentStatus }
  | { ok: false; reason: "stale"; number: number; latestNumber: number }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "unchanged" };

/** The one line the timeline shows for a person's edit; the note, if any, is its detail. */
export const editStepSummary = (number: number): string => `Edited the proposed change (revision ${number})`;

/**
 * A person edits the new contents of the latest revision's added and modified
 * files. Writes revision N+1 (author human, untouched files copied as they
 * were) and a HUMAN step, together or not at all.
 */
export const editFixRevision = ({
  db,
  revisionId,
  edits,
  note,
  now,
}: {
  db: Db;
  revisionId: number;
  edits: FileEdit[];
  note: string | null;
  now: number;
}): EditFixResult =>
  db.transaction((tx): EditFixResult => {
    const revision = getFixRevision({ db: tx, id: revisionId });
    if (revision === undefined) {
      return { ok: false, reason: "not-found" };
    }
    const incident = tx.select({ status: incidents.status }).from(incidents).where(eq(incidents.id, revision.incidentId)).get();
    if (incident === undefined) {
      return { ok: false, reason: "not-found" };
    }
    if (!isLiveForFixes(incident.status)) {
      return { ok: false, reason: "not-live", status: incident.status };
    }
    const latest = getLatestFixRevision({ db: tx, incidentId: revision.incidentId });
    if (latest !== undefined && latest.number !== revision.number) {
      return { ok: false, reason: "stale", number: revision.number, latestNumber: latest.number };
    }

    const files = listFilesForRevision({ db: tx, revisionId }).map(toRevisionFile);
    const editsByPath = new Map<string, string>();
    for (const edit of edits) {
      const file = files.find((candidate) => candidate.path === edit.path);
      if (file === undefined) {
        return { ok: false, reason: "invalid", message: `revision ${revision.number} has no file "${edit.path}"` };
      }
      if (file.action === "delete") {
        return { ok: false, reason: "invalid", message: `${edit.path} is deleted by this revision; only added and modified files can be edited` };
      }
      if (editsByPath.has(edit.path)) {
        return { ok: false, reason: "invalid", message: `path "${edit.path}" is edited more than once` };
      }
      editsByPath.set(edit.path, edit.after);
    }

    const nextFiles = files.map((file) => ({ ...file, after: editsByPath.get(file.path) ?? file.after }));
    if (nextFiles.every((file, index) => file.after === files[index]?.after)) {
      return { ok: false, reason: "unchanged" };
    }
    const check = validateRevisionFiles(nextFiles);
    if (!check.ok) {
      return { ok: false, reason: "invalid", message: check.message };
    }

    const next = insertRevision({
      tx,
      incidentId: revision.incidentId,
      number: revision.number + 1,
      author: "human",
      targetRepo: revision.targetRepo,
      baseSha: revision.baseSha,
      summary: revision.summary,
      files: nextFiles,
      now,
    });
    tx.insert(incidentSteps)
      .values({
        incidentId: revision.incidentId,
        role: "human",
        status: "succeeded",
        startedAt: now,
        finishedAt: now,
        summary: editStepSummary(next.number),
        detail: note,
      })
      .run();
    return { ok: true, revision: next };
  });
