// The overview's list of incidents, newest first: what is wrong, where it came
// from, where it sits in the state machine, and one line of evidence. Static so
// the Server Component renders it into the first HTML; each title links to the
// incident's detail route.
import Link from "next/link";
import type { ReactElement } from "react";
import type { IncidentSource, IncidentStatus } from "@/incidents/vocabulary";
import type { MetricName } from "@/vitals/metrics";
import { incidentSourceLabel, incidentStatusLabel, incidentStatusTone } from "../incidents";
import styles from "./IncidentsTable.module.css";
import { StatusPill } from "./StatusPill";
import { Timestamp } from "./Timestamp";

export interface IncidentRowData {
  id: string;
  source: IncidentSource;
  /** The path for a vitals regression, the check id for a health check. */
  subject: string;
  metric: MetricName | null;
  status: IncidentStatus;
  /** ISO string or epoch milliseconds. */
  detectedAt: string | number;
  /** From incidentTitle, e.g. "LCP on /pricing". */
  title: string;
  /** From describeEvidence: the one line that says why the incident exists. */
  headline: string;
}

export interface IncidentsTableProps {
  incidents: IncidentRowData[];
  /** Where a row's title links; defaults to the detail route. */
  hrefFor?: (id: string) => string;
}

const COLUMN_COUNT = 5;

const defaultHrefFor = (id: string): string => `/incidents/${id}`;

export const IncidentsTable = ({ incidents, hrefFor = defaultHrefFor }: IncidentsTableProps): ReactElement => (
  <div className={styles.scroller}>
    <table className={styles.table}>
      <caption className={styles.visuallyHidden}>Incidents, newest first</caption>
      <colgroup>
        <col className={styles.incidentColumn} />
        <col className={styles.sourceColumn} />
        <col className={styles.statusColumn} />
        <col className={styles.detectedColumn} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Incident</th>
          <th scope="col">Source</th>
          <th scope="col">Status</th>
          <th scope="col">Detected (UTC)</th>
          <th scope="col">Evidence</th>
        </tr>
      </thead>
      <tbody>
        {incidents.length === 0 && (
          <tr>
            <td colSpan={COLUMN_COUNT} className={styles.empty}>
              No incidents. The detector found nothing to report.
            </td>
          </tr>
        )}
        {incidents.map((incident) => (
          <tr key={incident.id}>
            <th scope="row" className={styles.incident} title={incident.title}>
              <Link href={hrefFor(incident.id)} className={styles.link}>
                {incident.title}
              </Link>
            </th>
            <td>{incidentSourceLabel(incident.source)}</td>
            <td>
              <StatusPill tone={incidentStatusTone(incident.status)}>{incidentStatusLabel(incident.status)}</StatusPill>
            </td>
            <td className={styles.detected}>
              <Timestamp value={incident.detectedAt} />
            </td>
            <td className={styles.headline} title={incident.headline}>
              {incident.headline}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
