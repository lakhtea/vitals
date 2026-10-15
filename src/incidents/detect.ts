// Runs detection for one site: loads the two comparison windows and the check
// history, asks the pure detector in ./detector.ts what should be open, and
// reconciles that with the incidents table (open what is new, resolve what
// has cleared, never touch a human decision). `npm run incidents:detect` and
// the detectIncidents mutation both call this.
import { and, eq, gt, inArray, or } from "drizzle-orm";
import type { Db } from "@/db";
import { UNFILTERED } from "@/db/queries/filter";
import { loadAllPathMetrics } from "@/db/queries/metrics";
import { checks, incidents, sites, type IncidentRow } from "@/db/schema";
import {
  DETECTION_RULES,
  findCheckFailures,
  findVitalsRegressions,
  hasVitalsRecovered,
  incidentIdentity,
  incidentIdentityKey,
  type MetricWindow,
} from "./detector";
import type { IncidentEvidence } from "./evidence";
import { ACTIVE_INCIDENT_STATUSES, isTransitionAllowed, type IncidentStatus } from "./vocabulary";

export interface DetectionResult {
  opened: number;
  resolved: number;
  /**
   * Findings that changed nothing (a live incident already covers the subject,
   * or a dismissal less than one window old still holds), plus open vitals
   * incidents with no finding whose page has not shown a recovery yet.
   */
  unchanged: number;
}

const NO_CHANGES: DetectionResult = { opened: 0, resolved: 0, unchanged: 0 };

/** The transaction handle `db.transaction` hands its callback. */
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

const loadWindow = ({ db, siteId, from, to }: { db: Db; siteId: string; from: number; to: number }): MetricWindow => ({
  from,
  to,
  rows: loadAllPathMetrics({ db, siteId, filter: { ...UNFILTERED, from, to } }).map((row) => ({
    path: row.path,
    metric: row.name,
    p75: row.p75,
    sampleCount: row.sampleCount,
  })),
});

interface Conditions {
  /** Everything that should have a live incident right now, from the pure detectors. */
  findings: IncidentEvidence[];
  /** The current window, kept so open regressions can be checked for recovery. */
  current: MetricWindow;
}

const findConditions = ({ db, siteId, now }: { db: Db; siteId: string; now: number }): Conditions => {
  const { windowMs } = DETECTION_RULES;
  const current = loadWindow({ db, siteId, from: now - windowMs, to: now });
  const baseline = loadWindow({ db, siteId, from: now - 2 * windowMs, to: now - windowMs });
  const observations = db.select().from(checks).where(eq(checks.siteId, siteId)).all();

  return {
    findings: [
      ...findVitalsRegressions({ baseline, current, rules: DETECTION_RULES }),
      ...findCheckFailures({ observations, rules: DETECTION_RULES }),
    ],
    current,
  };
};

const keyOfIncident = (incident: IncidentRow): string =>
  incidentIdentityKey({ source: incident.source, subject: incident.subject, metric: incident.metric });

const isLive = (status: IncidentStatus): boolean => (ACTIVE_INCIDENT_STATUSES as readonly IncidentStatus[]).includes(status);

/**
 * A check incident with no finding has cleared: its latest observation no
 * longer trips. A vitals incident with no finding has only stopped regressing
 * against the rolling baseline; it clears when the page shows a recovery
 * against the baseline frozen at detection (see hasVitalsRecovered).
 */
const hasCleared = ({ incident, current }: { incident: IncidentRow; current: MetricWindow }): boolean =>
  incident.evidence.kind === "health-check" ||
  hasVitalsRecovered({ evidence: incident.evidence, current, rules: DETECTION_RULES });

const resolveOpenIncident = ({ tx, incident, now }: { tx: Transaction; incident: IncidentRow; now: number }): void => {
  if (!isTransitionAllowed({ from: incident.status, to: "resolved" })) {
    throw new Error(`Incident ${incident.id} cannot move from ${incident.status} to resolved`);
  }
  tx.update(incidents).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(eq(incidents.id, incident.id)).run();
};

/**
 * Brings the incidents table in line with the findings. A finding opens an
 * incident unless one is live for its subject, or a human dismissed one less
 * than a window ago (a dismissal stands for one full window; after that the
 * same condition is news again). Only `open` incidents are ever resolved
 * here: every other status belongs to a human or to the agents.
 */
const reconcile = ({
  tx,
  siteId,
  findings,
  current,
  now,
}: {
  tx: Transaction;
  siteId: string;
  findings: ReadonlyArray<IncidentEvidence>;
  current: MetricWindow;
  now: number;
}): DetectionResult => {
  const relevant = tx
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.siteId, siteId),
        or(
          inArray(incidents.status, ACTIVE_INCIDENT_STATUSES),
          and(eq(incidents.status, "dismissed"), gt(incidents.updatedAt, now - DETECTION_RULES.windowMs)),
        ),
      ),
    )
    .all();
  const live = relevant.filter((incident) => isLive(incident.status));
  const coveredKeys = new Set(relevant.map(keyOfIncident));
  const backedKeys = new Set(findings.map((finding) => incidentIdentityKey(incidentIdentity(finding))));

  const result = { ...NO_CHANGES };

  for (const evidence of findings) {
    const identity = incidentIdentity(evidence);
    if (coveredKeys.has(incidentIdentityKey(identity))) {
      result.unchanged += 1;
      continue;
    }
    tx.insert(incidents)
      .values({ siteId, ...identity, status: "open", detectedAt: now, updatedAt: now, evidence })
      .run();
    result.opened += 1;
  }

  for (const incident of live) {
    if (incident.status !== "open" || backedKeys.has(keyOfIncident(incident))) {
      continue;
    }
    if (!hasCleared({ incident, current })) {
      result.unchanged += 1;
      continue;
    }
    resolveOpenIncident({ tx, incident, now });
    result.resolved += 1;
  }

  return result;
};

export const detectIncidents = ({ db, siteId, now = Date.now() }: { db: Db; siteId: string; now?: number }): DetectionResult => {
  const { findings, current } = findConditions({ db, siteId, now });
  return db.transaction((tx) => reconcile({ tx, siteId, findings, current, now }));
};

/** Every site in turn; the demo cold start and the CLI with no --site use this. */
export const detectIncidentsForAllSites = ({ db, now = Date.now() }: { db: Db; now?: number }): DetectionResult =>
  db
    .select({ id: sites.id })
    .from(sites)
    .all()
    .map((site) => detectIncidents({ db, siteId: site.id, now }))
    .reduce(
      (total, result) => ({
        opened: total.opened + result.opened,
        resolved: total.resolved + result.resolved,
        unchanged: total.unchanged + result.unchanged,
      }),
      NO_CHANGES,
    );
