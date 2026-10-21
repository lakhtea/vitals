"use client";

// The human gate: approve or dismiss an incident, with an optional note. The
// form owns only the note text; the page runs the mutation and reports busy and
// error back, so this component never knows GraphQL exists. Which buttons show
// is decided by the state machine, not by the page.
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { HUMAN_DECISIONS, isTransitionAllowed, type HumanDecision, type IncidentStatus } from "@/incidents/vocabulary";
import { incidentStatusLabel } from "../incidents";
import styles from "./IncidentActions.module.css";

export interface IncidentActionsProps {
  status: IncidentStatus;
  onDecide: (decision: HumanDecision, note: string) => void;
  /** True while the page is saving a decision; the buttons wait. */
  busy: boolean;
  /** The page's message when a save failed; announced, and cleared by the page on retry. */
  error: string | null;
}

const DECISION_LABELS: Record<HumanDecision, string> = {
  approved: "Approve",
  dismissed: "Dismiss",
};

const NOTE_ROWS = 3;

const preventSubmit = (event: FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
};

export const IncidentActions = ({ status, onDecide, busy, error }: IncidentActionsProps): ReactElement => {
  const id = useId();
  const noteId = `${id}-note`;
  const hintId = `${id}-hint`;
  const [note, setNote] = useState("");
  const allowedDecisions = HUMAN_DECISIONS.filter((decision) => isTransitionAllowed({ from: status, to: decision }));

  if (allowedDecisions.length === 0) {
    return (
      <p className={styles.closed}>
        This incident is {incidentStatusLabel(status).toLowerCase()}; no further decision is possible.
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={preventSubmit} aria-busy={busy}>
      <div className={styles.field}>
        <label htmlFor={noteId} className={styles.label}>
          Note (optional)
        </label>
        <textarea
          id={noteId}
          className={styles.note}
          rows={NOTE_ROWS}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby={hintId}
        />
        <p id={hintId} className={styles.hint}>
          Saved with your decision and shown on the incident.
        </p>
      </div>
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        {allowedDecisions.map((decision) => (
          <button
            key={decision}
            type="button"
            className={decision === "approved" ? styles.primary : styles.dismiss}
            disabled={busy}
            onClick={() => onDecide(decision, note.trim())}
          >
            {DECISION_LABELS[decision]}
          </button>
        ))}
        {busy && (
          <p role="status" className={styles.status}>
            Saving your decision…
          </p>
        )}
      </div>
    </form>
  );
};
