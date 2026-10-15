// Incident reads and the status writes: a human's approve or dismiss, and an
// agent's move along its stages. Each runs in a transaction so the read of the
// current status and the write cannot interleave with another caller, and the
// transition table in src/incidents/vocabulary.ts is consulted before anything is written.
import { and, asc, desc, eq } from "drizzle-orm";
import {
  type HumanDecision,
  type IncidentStatus,
  isAgentTransitionTarget,
  isTransitionAllowed,
} from "@/incidents/vocabulary";
import type { Db } from "../index";
import { fixRevisions, incidents, incidentSteps, type IncidentRow, type IncidentStepRow } from "../schema";

export const listIncidentsForSite = ({
  db,
  siteId,
  status = null,
  limit,
}: {
  db: Db;
  siteId: string;
  /** Null lists every status. */
  status?: IncidentStatus | null;
  limit: number;
}): IncidentRow[] =>
  db
    .select()
    .from(incidents)
    .where(and(eq(incidents.siteId, siteId), status === null ? undefined : eq(incidents.status, status)))
    .orderBy(desc(incidents.detectedAt), desc(incidents.id))
    .limit(limit)
    .all();

export const getIncident = ({ db, id }: { db: Db; id: number }): IncidentRow | undefined =>
  db.select().from(incidents).where(eq(incidents.id, id)).get();

/** Oldest first: the timeline reads top to bottom. */
export const listStepsForIncident = ({ db, incidentId }: { db: Db; incidentId: number }): IncidentStepRow[] =>
  db
    .select()
    .from(incidentSteps)
    .where(eq(incidentSteps.incidentId, incidentId))
    .orderBy(asc(incidentSteps.startedAt), asc(incidentSteps.id))
    .all();

/** The one line the timeline shows for a human decision; the note, if any, is its detail. */
const DECISION_SUMMARY: Record<HumanDecision, string> = {
  approved: "Approved",
  dismissed: "Dismissed",
};

export type DecisionResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "illegal-transition"; from: IncidentStatus; to: IncidentStatus }
  | { ok: false; reason: "revision-required"; latestNumber: number }
  | { ok: false; reason: "revision-not-found"; revisionId: number }
  | { ok: false; reason: "no-revisions" }
  | { ok: false; reason: "foreign-revision"; number: number; latestNumber: number }
  | { ok: false; reason: "stale-revision"; number: number; latestNumber: number };

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The approval pinning rule: when an incident has a proposed fix, approving
 * must name its latest revision (the one the person just read); when it has
 * none, approving must not name one. Null means the pin is acceptable.
 */
const pinProblem = ({
  tx,
  incidentId,
  revisionId,
}: {
  tx: Tx;
  incidentId: number;
  revisionId: number | null;
}): Exclude<DecisionResult, { ok: true } | { reason: "not-found" | "illegal-transition" }> | null => {
  const latest = tx
    .select({ id: fixRevisions.id, number: fixRevisions.number })
    .from(fixRevisions)
    .where(eq(fixRevisions.incidentId, incidentId))
    .orderBy(desc(fixRevisions.number))
    .limit(1)
    .get();
  if (latest === undefined) {
    return revisionId === null ? null : { ok: false, reason: "no-revisions" };
  }
  if (revisionId === null) {
    return { ok: false, reason: "revision-required", latestNumber: latest.number };
  }
  if (revisionId === latest.id) {
    return null;
  }
  const named = tx
    .select({ incidentId: fixRevisions.incidentId, number: fixRevisions.number })
    .from(fixRevisions)
    .where(eq(fixRevisions.id, revisionId))
    .get();
  if (named === undefined) {
    return { ok: false, reason: "revision-not-found", revisionId };
  }
  return named.incidentId === incidentId
    ? { ok: false, reason: "stale-revision", number: named.number, latestNumber: latest.number }
    : { ok: false, reason: "foreign-revision", number: named.number, latestNumber: latest.number };
};

/**
 * Moves an incident to a human decision. A refused transition is an expected
 * outcome (two people acting on the same incident), so it is a result, not an
 * exception; the resolver turns it into the GraphQL error the client shows.
 * Approving pins the fix revision the person read (see pinProblem); a
 * dismissal ignores revisionId.
 */
export const decideIncident = ({
  db,
  id,
  decision,
  note,
  revisionId = null,
  now,
}: {
  db: Db;
  id: number;
  decision: HumanDecision;
  note: string | null;
  /** The fix revision being approved; required when the incident has any. */
  revisionId?: number | null;
  now: number;
}): DecisionResult =>
  db.transaction((tx): DecisionResult => {
    const current = tx.select().from(incidents).where(eq(incidents.id, id)).get();
    if (current === undefined) {
      return { ok: false, reason: "not-found" };
    }
    if (!isTransitionAllowed({ from: current.status, to: decision })) {
      return { ok: false, reason: "illegal-transition", from: current.status, to: decision };
    }
    const approvedRevisionId = decision === "approved" ? revisionId : null;
    if (decision === "approved") {
      const problem = pinProblem({ tx, incidentId: id, revisionId });
      if (problem !== null) {
        return problem;
      }
    }

    const updated = tx
      .update(incidents)
      .set({ status: decision, note, approvedRevisionId, updatedAt: now })
      .where(eq(incidents.id, id))
      .returning()
      .get();
    tx.insert(incidentSteps)
      .values({
        incidentId: id,
        role: "human",
        status: "succeeded",
        startedAt: now,
        finishedAt: now,
        summary: DECISION_SUMMARY[decision],
        detail: note,
      })
      .run();

    return { ok: true, incident: updated };
  });

export type TransitionResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-agent-target"; to: IncidentStatus }
  | { ok: false; reason: "illegal-transition"; from: IncidentStatus; to: IncidentStatus };

/**
 * An agent moves an incident one stage along open -> triaged -> fix-proposed
 * -> reviewed -> awaiting-human. Two checks, in order: the target must be a
 * stage an agent may set at all (approving and dismissing belong to a person,
 * opening and resolving to the detector), and the transition table must allow
 * the move from where the incident is now, so no stage can be skipped.
 */
export const transitionIncident = ({
  db,
  id,
  to,
  now,
}: {
  db: Db;
  id: number;
  to: IncidentStatus;
  now: number;
}): TransitionResult => {
  if (!isAgentTransitionTarget(to)) {
    return { ok: false, reason: "not-agent-target", to };
  }
  return db.transaction((tx): TransitionResult => {
    const current = tx.select().from(incidents).where(eq(incidents.id, id)).get();
    if (current === undefined) {
      return { ok: false, reason: "not-found" };
    }
    if (!isTransitionAllowed({ from: current.status, to })) {
      return { ok: false, reason: "illegal-transition", from: current.status, to };
    }
    const updated = tx
      .update(incidents)
      .set({ status: to, updatedAt: now })
      .where(eq(incidents.id, id))
      .returning()
      .get();
    return { ok: true, incident: updated };
  });
};
