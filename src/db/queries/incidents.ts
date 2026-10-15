// Incident reads and the one write a human makes: approve or dismiss. The
// decision runs in a transaction so the status change and the step recording
// it land together or not at all, and the transition table in
// src/incidents/vocabulary.ts is consulted before anything is written.
import { and, asc, desc, eq } from "drizzle-orm";
import { type HumanDecision, type IncidentStatus, isTransitionAllowed } from "@/incidents/vocabulary";
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
