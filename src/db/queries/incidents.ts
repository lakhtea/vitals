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
import { incidents, incidentSteps, type IncidentRow, type IncidentStepRow } from "../schema";

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
  | { ok: false; reason: "illegal-transition"; from: IncidentStatus; to: IncidentStatus };

/**
 * Moves an incident to a human decision. A refused transition is an expected
 * outcome (two people acting on the same incident), so it is a result, not an
 * exception; the resolver turns it into the GraphQL error the client shows.
 */
export const decideIncident = ({
  db,
  id,
  decision,
  note,
  now,
}: {
  db: Db;
  id: number;
  decision: HumanDecision;
  note: string | null;
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

    const updated = tx
      .update(incidents)
      .set({ status: decision, note, updatedAt: now })
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
