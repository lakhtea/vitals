// The vocabulary of an incident: where it came from, which states it can be
// in, who may move it between them, and the roles a recorded step can have.
// The transition table is the one place the state machine is written down;
// resolvers and the detector both ask it before changing a status.
export const INCIDENT_SOURCES = ["web-vitals", "health-check"] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export const INCIDENT_STATUSES = [
  "open",
  "triaged",
  "fix-proposed",
  "reviewed",
  "awaiting-human",
  "approved",
  "dismissed",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Nothing moves out of these; a new incident for the same subject opens instead. */
export const TERMINAL_INCIDENT_STATUSES = ["dismissed", "resolved"] as const satisfies readonly IncidentStatus[];

/** Every status that still counts as "this incident is live" for de-duplication. */
export const ACTIVE_INCIDENT_STATUSES = INCIDENT_STATUSES.filter(
  (status): status is Exclude<IncidentStatus, (typeof TERMINAL_INCIDENT_STATUSES)[number]> =>
    !(TERMINAL_INCIDENT_STATUSES as readonly IncidentStatus[]).includes(status),
);

/**
 * Who may move an incident where. Agents (M15) walk open -> triaged ->
 * fix-proposed -> reviewed -> awaiting-human. A human may approve or dismiss
 * from any live state. Only the detector resolves an open incident whose
 * condition has cleared, and an approved one is resolved when its fix lands.
 */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["triaged", "approved", "dismissed", "resolved"],
  triaged: ["fix-proposed", "approved", "dismissed"],
  "fix-proposed": ["reviewed", "approved", "dismissed"],
  reviewed: ["awaiting-human", "approved", "dismissed"],
  "awaiting-human": ["approved", "dismissed"],
  approved: ["resolved"],
  dismissed: [],
  resolved: [],
};

export const isTransitionAllowed = ({ from, to }: { from: IncidentStatus; to: IncidentStatus }): boolean =>
  INCIDENT_TRANSITIONS[from].includes(to);

/** The decisions a person can take from the dashboard. */
export const HUMAN_DECISIONS = ["approved", "dismissed"] as const satisfies readonly IncidentStatus[];
export type HumanDecision = (typeof HUMAN_DECISIONS)[number];

export const STEP_ROLES = ["summarize", "propose-fix", "review", "open-pr", "human"] as const;
export type StepRole = (typeof STEP_ROLES)[number];

export const STEP_STATUSES = ["running", "succeeded", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];
